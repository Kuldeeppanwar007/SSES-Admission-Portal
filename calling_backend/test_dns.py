import socket
import dns.resolver

hosts = [
    "google.com",
    "agentflow.plivo.com",
    "api.groq.com",
    "cluster0.bbpgmdt.mongodb.net"
]

print("Testing DNS resolution via Cloudflare/Google DNS (8.8.8.8):")
resolver = dns.resolver.Resolver()
resolver.nameservers = ['8.8.8.8', '1.1.1.1']

for host in hosts:
    try:
        answers = resolver.resolve(host, 'A')
        ips = [rdata.address for rdata in answers]
        print(f"  {host} -> {ips} (OK)")
    except Exception as e:
        print(f"  {host} -> FAILED: {e}")

srv_host = "_mongodb._tcp.cluster0.bbpgmdt.mongodb.net"
try:
    print(f"\nTesting SRV record resolution for {srv_host}:")
    answers = resolver.resolve(srv_host, 'SRV')
    for rdata in answers:
        print(f"  SRV record: {rdata.target}:{rdata.port}")
except Exception as e:
    print(f"  SRV {srv_host} -> FAILED: {e}")
