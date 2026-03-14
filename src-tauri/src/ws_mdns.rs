use mdns_sd::{ServiceDaemon, ServiceInfo};

const SERVICE_TYPE: &str = "_divergence._tcp.local.";
const SERVICE_NAME: &str = "Divergence Desktop";

/// Advertises the Divergence WebSocket server over mDNS so that mobile clients
/// on the same local network can discover it automatically.
///
/// This function registers a `_divergence._tcp` service and keeps the mDNS
/// daemon alive for as long as the returned future is awaited (i.e. forever,
/// under normal circumstances). It should be spawned as a background task.
pub async fn advertise_mdns(port: u16) {
    let hostname = hostname();

    let mdns = match ServiceDaemon::new() {
        Ok(d) => d,
        Err(e) => {
            eprintln!("[ws_mdns] Failed to create mDNS daemon: {e}");
            return;
        }
    };

    let properties = [("version", "1"), ("hostname", hostname.as_str())];

    let service_info = match ServiceInfo::new(
        SERVICE_TYPE,
        SERVICE_NAME,
        &format!("{}.", hostname),
        "", // Let the library resolve the host IP addresses.
        port,
        &properties[..],
    ) {
        Ok(info) => info.enable_addr_auto(),
        Err(e) => {
            eprintln!("[ws_mdns] Failed to create service info: {e}");
            return;
        }
    };

    if let Err(e) = mdns.register(service_info) {
        eprintln!("[ws_mdns] Failed to register mDNS service: {e}");
        return;
    }

    eprintln!("[ws_mdns] Advertising {SERVICE_TYPE} on port {port} (hostname: {hostname})");

    // Keep the task alive so the daemon continues to respond to queries.
    // The daemon is shut down when this task is cancelled / the app exits.
    loop {
        tokio::time::sleep(std::time::Duration::from_secs(60)).await;
    }
}

/// Returns a short machine hostname suitable for mDNS TXT records.
fn hostname() -> String {
    gethostname::gethostname().to_string_lossy().into_owned()
}
