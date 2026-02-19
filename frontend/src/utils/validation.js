const IPV4_REGEX = /^((25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)$/;

const IPV6_REGEX = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]+|::(ffff(:0{1,4})?:)?((25[0-5]|(2[0-4]|1?\d)?\d)\.){3}(25[0-5]|(2[0-4]|1?\d)?\d)|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1?\d)?\d)\.){3}(25[0-5]|(2[0-4]|1?\d)?\d))$/;

export function isValidIPv4(value) {
  return IPV4_REGEX.test(value.trim());
}

export function isValidIPv6(value) {
  return IPV6_REGEX.test(value.trim());
}

export function isValidIP(value, version) {
  if (!value || !value.trim()) return true;
  if (version === 'ipv6') return isValidIPv6(value);
  return isValidIPv4(value);
}

export function validateIPList(value, version) {
  if (!value || !value.trim()) return null;

  const entries = value.split(',').map(s => s.trim()).filter(s => s);
  if (entries.length === 0) return null;

  const invalid = entries.filter(ip => !isValidIP(ip, version));

  if (invalid.length === 0) return null;

  const label = version === 'ipv6' ? 'IPv6' : 'IPv4';
  if (invalid.length === 1) {
    return `"${invalid[0]}" is not a valid ${label} address`;
  }
  return `The following are not valid ${label} addresses: ${invalid.join(', ')}`;
}

export function validateSingleIP(value, version) {
  if (!value || !value.trim()) return null;

  const label = version === 'ipv6' ? 'IPv6' : 'IPv4';
  if (!isValidIP(value, version)) {
    return `Enter a valid ${label} address`;
  }
  return null;
}
