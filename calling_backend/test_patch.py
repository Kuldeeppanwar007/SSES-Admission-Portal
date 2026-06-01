import socket
import dns.resolver
import httpx

_original_getaddrinfo = socket.getaddrinfo

def custom_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    host_str = host.decode('utf-8') if isinstance(host, bytes) else host
    if host_str == "agentflow.plivo.com" or "mongodb.net" in host_str or "groq.com" in host_str:
        print(f"[DNS Patch] Intercepted lookup for {host_str}:{port} (Input host type: {host.__class__})")
        try:
            resolver = dns.resolver.Resolver()
            resolver.nameservers = ['8.8.8.8', '1.1.1.1']
            resolver.timeout = 5
            resolver.lifetime = 5
            answers = resolver.resolve(host_str, 'A')
            ips = [rdata.address for rdata in answers]
            
            resolved_port = port
            if isinstance(port, str):
                if port == "https":
                    resolved_port = 443
                elif port == "http":
                    resolved_port = 80
                else:
                    try:
                        resolved_port = socket.getservbyname(port)
                    except Exception:
                        try:
                            resolved_port = int(port)
                        except Exception:
                            resolved_port = 0
            elif port is None:
                resolved_port = 0

            results = []
            for ip in ips:
                f = family if family != 0 else socket.AF_INET
                t = type if type != 0 else socket.SOCK_STREAM
                p = proto if proto != 0 else 6
                results.append((f, t, p, '', (ip, resolved_port)))
            if results:
                print(f"[DNS Patch] Resolved {host_str} to {ips} with port {resolved_port}")
                return results
        except Exception as e:
            print(f"[DNS Patch] Custom resolve failed: {e}")
            
    return _original_getaddrinfo(host, port, family, type, proto, flags)

socket.getaddrinfo = custom_getaddrinfo

try:
    print("Testing getaddrinfo with bytes host:")
    res = socket.getaddrinfo(b"agentflow.plivo.com", "https")
    print("Success getaddrinfo bytes:", res)
    
    print("\nTesting httpx request to https://agentflow.plivo.com (will trigger DNS lookups):")
    with httpx.Client(timeout=5) as client:
        resp = client.get("https://agentflow.plivo.com/health")
        print("Status:", resp.status_code)
except Exception as e:
    import traceback
    traceback.print_exc()
