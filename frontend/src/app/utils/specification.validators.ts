import { AbstractControl, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Strict IPv4 validator shared by Demande, Changement and Incident. */
export const IPV4_REGEX = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

function empty(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === '';
}

function isIpv4(value: unknown): boolean {
  return !empty(value) && IPV4_REGEX.test(String(value).trim());
}

function ipv4ToNumber(value: string): number {
  return value.split('.').reduce((result, octet) => result * 256 + Number(octet), 0);
}

export function ipv4Validator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (empty(control.value)) return null;
    return isIpv4(control.value) ? null : { ipv4: true };
  };
}

/** IPv4 in CIDR notation, for example 10.10.0.0/16. */
export function cidrValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (empty(control.value)) return null;
    const value = String(control.value).trim();
    const [ip, prefix] = value.split('/');
    const prefixNumber = Number(prefix);
    if (!isIpv4(ip) || !/^\d{1,2}$/.test(prefix || '') || prefixNumber < 0 || prefixNumber > 32) {
      return { cidr: true };
    }
    return null;
  };
}

/** Accepts an address, a CIDR network or a named zone/object (WAN, DMZ, any…). */
export function addressOrZoneValidator(): ValidatorFn {
  const zonePattern = /^(any|wan|lan|dmz|internet|intranet|[a-z][a-z0-9._-]{1,62})$/i;
  return (control: AbstractControl): ValidationErrors | null => {
    if (empty(control.value)) return null;
    const value = String(control.value).trim();
    const addressControl = { value } as AbstractControl;
    return isIpv4(value) || cidrValidator()(addressControl) === null || zonePattern.test(value)
      ? null
      : { addressOrZone: true };
  };
}

export function hostnameValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (empty(control.value)) return null;
    const value = String(control.value).trim();
    if (value.length > 253 || value.endsWith('.') || value.includes('..')) return { hostname: true };
    const valid = value.split('.').every((label) =>
      /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label)
    );
    return valid ? null : { hostname: true };
  };
}

export function hostnameOrIpv4Validator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (empty(control.value)) return null;
    return isIpv4(control.value) || hostnameValidator()(control) === null ? null : { hostnameOrIpv4: true };
  };
}

export function portValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (empty(control.value)) return null;
    const value = Number(control.value);
    return Number.isInteger(value) && value >= 1 && value <= 65535 ? null : { port: true };
  };
}

/** Comma/space separated ports and ranges, e.g. 443, 8000-8010. */
export function portListValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (empty(control.value)) return null;
    const items = String(control.value)
      .split(/[;,\s]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    const valid = items.every((item) => {
      const [range, transport] = item.split('/');
      if (transport && !['tcp', 'udp', 'icmp'].includes(transport.toLowerCase())) return false;
      const parts = range.split('-');
      if (parts.length > 2 || parts.some((part) => !/^\d+$/.test(part))) return false;
      const start = Number(parts[0]);
      const end = Number(parts[1] ?? parts[0]);
      return start >= 1 && end <= 65535 && start <= end;
    });
    return valid ? null : { portList: true };
  };
}

export function vlanValidator(): ValidatorFn {
  return integerRangeValidator(1, 4094, 'vlan');
}

export function integerRangeValidator(min: number, max: number, errorKey = 'integerRange'): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (empty(control.value)) return null;
    const value = Number(control.value);
    return Number.isInteger(value) && value >= min && value <= max ? null : { [errorKey]: true };
  };
}

export function numberRangeValidator(min: number, max: number, errorKey = 'numberRange'): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (empty(control.value)) return null;
    const value = Number(control.value);
    return Number.isFinite(value) && value >= min && value <= max ? null : { [errorKey]: true };
  };
}

/** Software versions such as 12.4, 550.54.15 and 535.x. */
export function versionValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (empty(control.value)) return null;
    return /^\d+(?:\.(?:\d+|x)){1,3}(?:[-+][0-9A-Za-z.-]+)?$/.test(String(control.value).trim())
      ? null
      : { version: true };
  };
}

/** Ensures a DHCP start/end pair is ordered when both values are provided. */
export function dateNotBeforeTodayValidator(): ValidatorFn {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (control: AbstractControl): ValidationErrors | null => {
    if (empty(control.value)) return null;
    const selected = new Date(`${control.value}T00:00:00`);
    return Number.isNaN(selected.getTime()) || selected < today ? { pastDate: true } : null;
  };
}

export function ipRangeValidator(startKey: string, endKey: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!(control instanceof FormGroup)) return null;
    const start = control.get(startKey)?.value;
    const end = control.get(endKey)?.value;
    if (empty(start) || empty(end)) return null;
    if (!isIpv4(start) || !isIpv4(end)) return null;
    return ipv4ToNumber(String(start).trim()) <= ipv4ToNumber(String(end).trim()) ? null : { ipRange: true };
  };
}

export type SpecificationValidatorKind =
  | 'ipv4'
  | 'cidr'
  | 'hostname'
  | 'hostnameOrIpv4'
  | 'addressOrZone'
  | 'port'
  | 'portList'
  | 'vlan'
  | 'positiveInteger'
  | 'positiveNumber'
  | 'version';

export function validatorFor(kind: SpecificationValidatorKind): ValidatorFn {
  switch (kind) {
    case 'ipv4':
      return ipv4Validator();
    case 'cidr':
      return cidrValidator();
    case 'hostname':
      return hostnameValidator();
    case 'hostnameOrIpv4':
      return hostnameOrIpv4Validator();
    case 'addressOrZone':
      return addressOrZoneValidator();
    case 'port':
      return portValidator();
    case 'portList':
      return portListValidator();
    case 'vlan':
      return vlanValidator();
    case 'positiveInteger':
      return integerRangeValidator(1, Number.MAX_SAFE_INTEGER, 'positiveInteger');
    case 'positiveNumber':
      return numberRangeValidator(0.000001, Number.MAX_SAFE_INTEGER, 'positiveNumber');
    case 'version':
      return versionValidator();
  }
}
