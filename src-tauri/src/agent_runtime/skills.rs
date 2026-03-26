use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSkillDescriptor {
    pub name: String,
    pub description: String,
    pub source: AgentSkillSource,
    pub scope: AgentSkillScope,
    pub provider_hint: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "kebab-case")]
#[allow(dead_code)]
pub enum AgentSkillSource {
    Bundled,
    User,
    System,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum AgentSkillScope {
    Global,
    Project,
}

pub fn discover_skills(project_path: &str) -> Vec<AgentSkillDescriptor> {
    let mut skills = Vec::new();
    let home = dirs::home_dir().unwrap_or_default();

    // 1. Claude Code legacy commands (~/.claude/commands/*.md)
    collect_legacy_commands(
        &home.join(".claude").join("commands"),
        AgentSkillScope::Global,
        &mut skills,
    );

    // 2. Project-level Claude commands ({project}/.claude/commands/*.md)
    collect_legacy_commands(
        &Path::new(project_path).join(".claude").join("commands"),
        AgentSkillScope::Project,
        &mut skills,
    );

    // 3. Claude Code skills (~/.claude/skills/*/SKILL.md)
    collect_skill_md_entries(
        &home.join(".claude").join("skills"),
        AgentSkillScope::Global,
        None,
        &mut skills,
    );

    // 4. Project-level Claude skills ({project}/.claude/skills/*/SKILL.md)
    collect_skill_md_entries(
        &Path::new(project_path).join(".claude").join("skills"),
        AgentSkillScope::Project,
        None,
        &mut skills,
    );

    // 5. Codex skills (~/.codex/skills/*/SKILL.md, excluding .system)
    collect_skill_md_entries(
        &home.join(".codex").join("skills"),
        AgentSkillScope::Global,
        Some("codex"),
        &mut skills,
    );

    // 6. Project-level Codex skills ({project}/.codex/skills/*/SKILL.md)
    collect_skill_md_entries(
        &Path::new(project_path).join(".codex").join("skills"),
        AgentSkillScope::Project,
        Some("codex"),
        &mut skills,
    );

    // Deduplicate by name, preferring project-scoped over global
    deduplicate_skills(&mut skills);

    skills
}

fn collect_legacy_commands(
    dir: &Path,
    scope: AgentSkillScope,
    out: &mut Vec<AgentSkillDescriptor>,
) {
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("md") {
            continue;
        }
        let name = path
            .file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or_default()
            .to_string();
        if name.is_empty() {
            continue;
        }

        let content = match fs::read_to_string(&path) {
            Ok(content) => content,
            Err(_) => continue,
        };

        let description = extract_first_content_line(&content);

        out.push(AgentSkillDescriptor {
            name,
            description,
            source: AgentSkillSource::User,
            scope: scope.clone(),
            provider_hint: None,
        });
    }
}

fn collect_skill_md_entries(
    dir: &Path,
    scope: AgentSkillScope,
    provider_hint: Option<&str>,
    out: &mut Vec<AgentSkillDescriptor>,
) {
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let entry_path = entry.path();
        if !entry_path.is_dir() {
            continue;
        }
        let dir_name = entry_path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default();

        if dir_name.starts_with('.') {
            continue;
        }

        let skill_md_path = entry_path.join("SKILL.md");
        if !skill_md_path.exists() {
            continue;
        }

        let content = match fs::read_to_string(&skill_md_path) {
            Ok(content) => content,
            Err(_) => continue,
        };

        let (name, description) = parse_skill_frontmatter(&content, dir_name);

        out.push(AgentSkillDescriptor {
            name,
            description,
            source: AgentSkillSource::User,
            scope: scope.clone(),
            provider_hint: provider_hint.map(str::to_string),
        });
    }
}

fn parse_skill_frontmatter(content: &str, fallback_name: &str) -> (String, String) {
    let trimmed = content.trim();
    if !trimmed.starts_with("---") {
        return (
            fallback_name.to_string(),
            extract_first_content_line(content),
        );
    }

    let after_first_fence = &trimmed[3..];
    let end_pos = after_first_fence.find("\n---");
    let frontmatter_block = match end_pos {
        Some(pos) => &after_first_fence[..pos],
        None => {
            return (
                fallback_name.to_string(),
                extract_first_content_line(content),
            );
        }
    };

    let mut name = None;
    let mut description = None;

    for line in frontmatter_block.lines() {
        let line = line.trim();
        if let Some(value) = line.strip_prefix("name:") {
            name = Some(strip_yaml_quotes(value));
        } else if let Some(value) = line.strip_prefix("description:") {
            description = Some(strip_yaml_quotes(value));
        }
    }

    (
        name.unwrap_or_else(|| fallback_name.to_string()),
        description.unwrap_or_default(),
    )
}

fn strip_yaml_quotes(value: &str) -> String {
    let trimmed = value.trim();
    if (trimmed.starts_with('"') && trimmed.ends_with('"'))
        || (trimmed.starts_with('\'') && trimmed.ends_with('\''))
    {
        trimmed[1..trimmed.len() - 1].to_string()
    } else {
        trimmed.to_string()
    }
}

fn extract_first_content_line(content: &str) -> String {
    let in_frontmatter = content.trim().starts_with("---");
    let mut past_frontmatter = !in_frontmatter;
    let mut fence_count = 0;

    for line in content.lines() {
        let trimmed = line.trim();
        if in_frontmatter && trimmed == "---" {
            fence_count += 1;
            if fence_count >= 2 {
                past_frontmatter = true;
            }
            continue;
        }
        if !past_frontmatter {
            continue;
        }
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        return trimmed.to_string();
    }

    String::new()
}

fn deduplicate_skills(skills: &mut Vec<AgentSkillDescriptor>) {
    let mut seen: std::collections::HashMap<String, (usize, bool)> =
        std::collections::HashMap::new();
    let mut indices_to_remove: Vec<usize> = Vec::new();

    for (index, skill) in skills.iter().enumerate() {
        let is_project = matches!(skill.scope, AgentSkillScope::Project);
        if let Some(&(existing_index, existing_is_project)) = seen.get(&skill.name) {
            if is_project && !existing_is_project {
                indices_to_remove.push(existing_index);
                seen.insert(skill.name.clone(), (index, is_project));
            } else {
                indices_to_remove.push(index);
            }
        } else {
            seen.insert(skill.name.clone(), (index, is_project));
        }
    }

    indices_to_remove.sort_unstable();
    indices_to_remove.dedup();
    for index in indices_to_remove.into_iter().rev() {
        skills.remove(index);
    }
}

#[cfg(test)]
mod tests {
    use super::{
        deduplicate_skills, extract_first_content_line, parse_skill_frontmatter,
        AgentSkillDescriptor, AgentSkillScope, AgentSkillSource,
    };

    #[test]
    fn parses_skill_frontmatter_with_name_and_description() {
        let content = r#"---
name: my-skill
description: Does something useful
---

# My Skill

Body text here."#;

        let (name, description) = parse_skill_frontmatter(content, "fallback");
        assert_eq!(name, "my-skill");
        assert_eq!(description, "Does something useful");
    }

    #[test]
    fn parses_quoted_frontmatter_values() {
        let content = r#"---
name: "quoted-skill"
description: 'Single quoted description'
---"#;

        let (name, description) = parse_skill_frontmatter(content, "fallback");
        assert_eq!(name, "quoted-skill");
        assert_eq!(description, "Single quoted description");
    }

    #[test]
    fn falls_back_to_dir_name_when_no_frontmatter() {
        let content = "# Just a heading\n\nSome body text.";
        let (name, description) = parse_skill_frontmatter(content, "dir-name");
        assert_eq!(name, "dir-name");
        assert_eq!(description, "Some body text.");
    }

    #[test]
    fn extracts_first_content_line_skipping_headings_and_blanks() {
        let content = "# Title\n\n\nActual description here.\n\nMore text.";
        assert_eq!(
            extract_first_content_line(content),
            "Actual description here."
        );
    }

    #[test]
    fn extracts_first_content_line_after_frontmatter() {
        let content = "---\nname: test\n---\n\n# Heading\n\nDescription line.";
        assert_eq!(extract_first_content_line(content), "Description line.");
    }

    #[test]
    fn deduplicates_preferring_project_scope() {
        let mut skills = vec![
            AgentSkillDescriptor {
                name: "my-skill".to_string(),
                description: "Global version".to_string(),
                source: AgentSkillSource::User,
                scope: AgentSkillScope::Global,
                provider_hint: None,
            },
            AgentSkillDescriptor {
                name: "my-skill".to_string(),
                description: "Project version".to_string(),
                source: AgentSkillSource::User,
                scope: AgentSkillScope::Project,
                provider_hint: None,
            },
        ];
        deduplicate_skills(&mut skills);
        assert_eq!(skills.len(), 1);
        assert_eq!(skills[0].description, "Project version");
    }
}
