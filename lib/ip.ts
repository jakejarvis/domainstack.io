import * as ipaddr from "ipaddr.js";

export function ipV4InCidr(addr: ipaddr.IPv4, cidr: string): boolean {
  try {
    const [net, prefix] = ipaddr.parseCIDR(cidr);
    if (net.kind() !== "ipv4") return false;
    return addr.match([net as ipaddr.IPv4, prefix]);
  } catch {
    return false;
  }
}

export function ipV6InCidr(addr: ipaddr.IPv6, cidr: string): boolean {
  try {
    const [net, prefix] = ipaddr.parseCIDR(cidr);
    if (net.kind() !== "ipv6") return false;
    return addr.match([net as ipaddr.IPv6, prefix]);
  } catch {
    return false;
  }
}
