use serde_json::Value;

pub(crate) fn read_provider_thread_id(value: &Value) -> Option<String> {
    value
        .get("session_id")
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| {
            value
                .get("chat_id")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .or_else(|| {
            value
                .get("chatId")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .or_else(|| {
            value
                .get("conversation_id")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
}

pub(crate) fn read_provider_content_text(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => Some(text.to_string()),
        Value::Object(map) => map
            .get("text")
            .and_then(Value::as_str)
            .map(str::to_string)
            .or_else(|| map.get("content").and_then(read_provider_content_text)),
        Value::Array(items) => {
            let text_parts: Vec<String> = items
                .iter()
                .filter_map(read_provider_content_text)
                .filter(|item| !item.is_empty())
                .collect();
            (!text_parts.is_empty()).then(|| text_parts.join(""))
        }
        _ => None,
    }
}

pub(crate) fn read_provider_text_delta(value: &Value) -> Option<String> {
    value
        .get("text")
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| value.get("content").and_then(read_provider_content_text))
        .or_else(|| {
            value
                .get("delta")
                .and_then(|delta| delta.get("text"))
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .or_else(|| {
            value
                .get("message")
                .and_then(|message| message.get("content"))
                .and_then(read_provider_content_text)
        })
}

#[derive(Debug)]
pub(crate) enum ProviderOutputChunk {
    Text(String),
    Json(Value),
}

pub(crate) fn split_provider_output_chunks(input: &str) -> Vec<ProviderOutputChunk> {
    let mut chunks = Vec::new();
    let mut current_text_start = 0usize;
    let mut json_start: Option<usize> = None;
    let mut depth = 0usize;
    let mut in_string = false;
    let mut escaped = false;

    for (index, character) in input.char_indices() {
        if json_start.is_some() {
            if in_string {
                if escaped {
                    escaped = false;
                    continue;
                }
                match character {
                    '\\' => escaped = true,
                    '"' => in_string = false,
                    _ => {}
                }
                continue;
            }

            match character {
                '"' => in_string = true,
                '{' => depth += 1,
                '}' => {
                    depth = depth.saturating_sub(1);
                    if depth == 0 {
                        let start = json_start.expect("json start should be set when parsing");
                        if current_text_start < start {
                            let text = input[current_text_start..start].trim();
                            if !text.is_empty() {
                                chunks.push(ProviderOutputChunk::Text(text.to_string()));
                            }
                        }

                        let end = index + character.len_utf8();
                        let candidate = &input[start..end];
                        if let Ok(value) = serde_json::from_str::<Value>(candidate) {
                            chunks.push(ProviderOutputChunk::Json(value));
                            current_text_start = end;
                        }
                        json_start = None;
                        in_string = false;
                        escaped = false;
                    }
                }
                _ => {}
            }
            continue;
        }

        if character == '{' {
            json_start = Some(index);
            depth = 1;
            in_string = false;
            escaped = false;
        }
    }

    if json_start.is_some() || current_text_start < input.len() {
        let text = input[current_text_start..].trim();
        if !text.is_empty() {
            chunks.push(ProviderOutputChunk::Text(text.to_string()));
        }
    }

    chunks
}

pub(crate) fn read_provider_activity_id(value: &Value) -> Option<String> {
    value
        .get("tool_call_id")
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| {
            value
                .get("toolCallId")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .or_else(|| value.get("id").and_then(Value::as_str).map(str::to_string))
}

pub(crate) fn read_provider_activity_title(value: &Value) -> Option<String> {
    value
        .get("tool_name")
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| {
            value
                .get("toolName")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .or_else(|| {
            value
                .get("name")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
}
