import { FormGroup } from '@angular/forms';
import { SpecificationValidatorKind } from './specification.validators';

export type SpecificationFieldType = 'text' | 'textarea' | 'number' | 'select' | 'radio' | 'date' | 'time' | 'url';

export interface SpecificationOption {
  value: string;
  labelKey: string;
  enumMap?: string;
}

export interface SpecificationField {
  key: string;
  labelKey: string;
  type: SpecificationFieldType;
  placeholderKey?: string;
  helperKey?: string;
  errorKey?: string;
  required?: boolean;
  requiredWhen?: (form: FormGroup) => boolean;
  validators?: SpecificationValidatorKind[];
  options?: SpecificationOption[];
  min?: number;
  max?: number;
  step?: number;
  rows?: number;
  fullWidth?: boolean;
  visibleWhen?: (form: FormGroup) => boolean;
}

export interface SpecificationSection {
  id: string;
  titleKey: string;
  hintKey: string;
  fields: SpecificationField[];
}

const option = (value: string, labelKey = value, enumMap?: string): SpecificationOption => ({ value, labelKey, enumMap });
const options = (values: string[], enumMap?: string): SpecificationOption[] => values.map((value) => option(value, value, enumMap));
const when = (path: string, values: string[]) => (form: FormGroup): boolean => values.includes(form.get(path)?.value);

const ouiNon = options(['Oui', 'Non'], 'ouiNon');
const environnements = [
  option('Production', 'Production', 'environment'),
  option('Pré-production', 'Pré-production', 'environment'),
  option('Test', 'Test', 'environment'),
  option('Développement', 'Développement', 'environment'),
  option('UAT', 'UAT', 'environment'),
];

export const SPECIFICATION_SECTIONS: SpecificationSection[] = [
  {
    id: 'general',
    titleKey: 'specs.general',
    hintKey: 'specs.generalHint',
    fields: [
      { key: 'ressourcesConcernees', labelKey: 'specs.resources', type: 'text', placeholderKey: 'specs.ph.resources', helperKey: 'specs.help.resources' },
      { key: 'commentaire', labelKey: 'specs.comment', type: 'textarea', placeholderKey: 'specs.ph.comment', rows: 2, fullWidth: true },
    ],
  },
  {
    id: 'serveur',
    titleKey: 'specs.server',
    hintKey: 'specs.serverHint',
    fields: [
      { key: 'hostname', labelKey: 'specs.f.hostname', type: 'text', placeholderKey: 'specs.ph.hostname', helperKey: 'specs.help.hostname', validators: ['hostname'], required: true },
      { key: 'environnementVm', labelKey: 'specs.f.environnementVm', type: 'select', options: environnements, required: true },
      {
        key: 'os', labelKey: 'specs.f.os', type: 'select', options: [
          option('Ubuntu', 'specs.option.ubuntu'), option('Ubuntu 22.04', 'specs.option.ubuntu2204'), option('Ubuntu 24.04', 'specs.option.ubuntu2404'), option('Debian', 'specs.option.debian'), option('Rocky Linux', 'specs.option.rocky'),
          option('Windows Server', 'specs.option.windowsServer'), option('RHEL', 'specs.option.rhel'), option('Autre', 'form.autre'),
        ], required: true,
      },
      { key: 'osPrecision', labelKey: 'specs.f.osPrecision', type: 'text', placeholderKey: 'specs.ph.osPrecision', required: true, visibleWhen: when('serveur.os', ['Autre']) },
      { key: 'cpuCores', labelKey: 'specs.f.cpuCores', type: 'number', placeholderKey: 'specs.ph.cpuCores', helperKey: 'specs.help.cpuCores', validators: ['positiveInteger'], min: 1, max: 512, step: 1, required: true, requiredWhen: (form) => form.get('sousCategorie')?.value === 'Création VM' },
      { key: 'ramGo', labelKey: 'specs.f.ramGo', type: 'number', placeholderKey: 'specs.ph.ramGo', helperKey: 'specs.help.ramGo', validators: ['positiveNumber'], min: 1, max: 16384, step: 1, required: true, requiredWhen: (form) => form.get('sousCategorie')?.value === 'Création VM' },
      { key: 'reseauVm', labelKey: 'specs.f.reseauVm', type: 'text', placeholderKey: 'specs.ph.reseauVm', required: true },
      { key: 'configIp', labelKey: 'specs.f.configIp', type: 'select', options: [option('DHCP', 'specs.option.dhcp'), option('Statique', 'specs.option.staticIp')], required: true },
      { key: 'datacenter', labelKey: 'specs.f.datacenter', type: 'text', placeholderKey: 'specs.ph.datacenter', required: true },
      { key: 'vmCible', labelKey: 'specs.f.vmCible', type: 'text', placeholderKey: 'specs.ph.vmCible', helperKey: 'specs.help.resourceName', required: true },
      { key: 'typeRessource', labelKey: 'specs.f.typeRessource', type: 'select', options: [option('vCPU', 'specs.option.vcpu'), option('RAM', 'specs.option.ram'), option('Disque', 'specs.option.disk'), option('GPU', 'specs.option.gpu')], required: true },
      { key: 'valeurActuelle', labelKey: 'specs.f.valeurActuelle', type: 'number', placeholderKey: 'specs.ph.resourceValue', validators: ['positiveNumber'], min: 0, step: 1, required: true },
      { key: 'valeurDemandee', labelKey: 'specs.f.valeurDemandee', type: 'number', placeholderKey: 'specs.ph.resourceValue', validators: ['positiveNumber'], min: 0, step: 1, required: true },
      { key: 'vmSource', labelKey: 'specs.f.vmSource', type: 'text', placeholderKey: 'specs.ph.vmSource', helperKey: 'specs.help.resourceName', required: true },
      { key: 'nouveauNomVm', labelKey: 'specs.f.nouveauNomVm', type: 'text', placeholderKey: 'specs.ph.hostname', validators: ['hostname'], required: true },
      { key: 'destinationVm', labelKey: 'specs.f.destinationVm', type: 'text', placeholderKey: 'specs.ph.destinationVm', required: true },
      { key: 'optionsPersonnalisation', labelKey: 'specs.f.optionsPersonnalisation', type: 'textarea', placeholderKey: 'specs.ph.optionsPersonnalisation', rows: 3, fullWidth: true },
      { key: 'hoteSource', labelKey: 'specs.f.hoteSource', type: 'text', placeholderKey: 'specs.ph.host', required: true },
      { key: 'hoteDestination', labelKey: 'specs.f.hoteDestination', type: 'text', placeholderKey: 'specs.ph.host', required: true },
      { key: 'typeMigration', labelKey: 'specs.f.typeMigration', type: 'select', options: [option('À chaud', 'specs.option.liveMigration'), option('À froid', 'specs.option.coldMigration'), option('Stockage uniquement', 'specs.option.storageMigration')], required: true },
      { key: 'downtimeEstime', labelKey: 'specs.f.downtimeEstime', type: 'number', placeholderKey: 'specs.ph.minutes', helperKey: 'specs.help.minutes', validators: ['positiveNumber'], min: 0, max: 10080, step: 1, required: true },
      { key: 'impactReseau', labelKey: 'specs.f.impactReseau', type: 'textarea', placeholderKey: 'specs.ph.impactReseau', rows: 2, fullWidth: true, required: true },
      { key: 'confirmationBackup', labelKey: 'specs.f.confirmationBackup', type: 'radio', options: ouiNon, required: true },
      { key: 'confirmationSnapshot', labelKey: 'specs.f.confirmationSnapshot', type: 'radio', options: ouiNon, required: true },
      { key: 'retentionDonnees', labelKey: 'specs.f.retentionDonnees', type: 'number', placeholderKey: 'specs.ph.days', helperKey: 'specs.help.days', validators: ['positiveInteger'], min: 1, max: 3650, step: 1 },
      { key: 'motifDecommission', labelKey: 'specs.f.motifDecommission', type: 'textarea', placeholderKey: 'specs.ph.reason', rows: 3, fullWidth: true, required: true },
      { key: 'nomSnapshot', labelKey: 'specs.f.nomSnapshot', type: 'text', placeholderKey: 'specs.ph.snapshotName', required: true },
      { key: 'descriptionSnapshot', labelKey: 'specs.f.descriptionSnapshot', type: 'textarea', placeholderKey: 'specs.ph.snapshotDescription', rows: 3, fullWidth: true },
      { key: 'retentionSnapshot', labelKey: 'specs.f.retentionSnapshot', type: 'number', placeholderKey: 'specs.ph.days', validators: ['positiveInteger'], min: 1, max: 3650, step: 1 },
      { key: 'expirationSnapshot', labelKey: 'specs.f.expirationSnapshot', type: 'date', helperKey: 'specs.help.futureDate' },
    ],
  },
  {
    id: 'reseau',
    titleKey: 'specs.network',
    hintKey: 'specs.networkHint',
    fields: [
      { key: 'vlan', labelKey: 'specs.f.vlan', type: 'number', placeholderKey: 'specs.ph.vlan', helperKey: 'specs.help.vlan', validators: ['vlan'], min: 1, max: 4094, step: 1, required: true },
      { key: 'vlanName', labelKey: 'specs.f.vlanName', type: 'text', placeholderKey: 'specs.ph.vlanName' },
      { key: 'descriptionVlan', labelKey: 'specs.f.descriptionVlan', type: 'textarea', placeholderKey: 'specs.ph.description', rows: 2, fullWidth: true },
      { key: 'interfaceAssociee', labelKey: 'specs.f.interfaceAssociee', type: 'text', placeholderKey: 'specs.ph.interface' },
      { key: 'reseauCidr', labelKey: 'specs.f.reseauCidr', type: 'text', placeholderKey: 'specs.ph.reseauCidr', helperKey: 'specs.help.cidr', errorKey: 'specs.cidrInvalid', validators: ['cidr'], required: true },
      { key: 'adresseIp', labelKey: 'specs.f.adresseIp', type: 'text', placeholderKey: 'specs.ph.adresseIp', helperKey: 'specs.help.ipv4', errorKey: 'specs.ipv4Invalid', validators: ['ipv4'], required: true },
      { key: 'masqueSousReseau', labelKey: 'specs.f.masqueSousReseau', type: 'text', placeholderKey: 'specs.ph.masqueSousReseau', errorKey: 'specs.ipv4Invalid', validators: ['ipv4'] },
      { key: 'passerelle', labelKey: 'specs.f.passerelle', type: 'text', placeholderKey: 'specs.ph.passerelle', errorKey: 'specs.ipv4Invalid', validators: ['ipv4'] },
      { key: 'dnsPrimaire', labelKey: 'specs.f.dnsPrimaire', type: 'text', placeholderKey: 'specs.ph.dns', errorKey: 'specs.ipv4Invalid', validators: ['ipv4'] },
      { key: 'dnsSecondaire', labelKey: 'specs.f.dnsSecondaire', type: 'text', placeholderKey: 'specs.ph.dns', errorKey: 'specs.ipv4Invalid', validators: ['ipv4'] },
      { key: 'zoneDns', labelKey: 'specs.f.zoneDns', type: 'text', placeholderKey: 'specs.ph.dnsZone', validators: ['hostname'], required: true },
      { key: 'typeEnregistrement', labelKey: 'specs.f.typeEnregistrement', type: 'select', options: ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'PTR'].map((v) => option(v, `specs.option.record.${v}`)), required: true },
      { key: 'nomEnregistrement', labelKey: 'specs.f.nomEnregistrement', type: 'text', placeholderKey: 'specs.ph.recordName', required: true },
      { key: 'valeurActuelle', labelKey: 'specs.f.valeurActuelle', type: 'text', placeholderKey: 'specs.ph.dnsValue' },
      { key: 'nouvelleValeur', labelKey: 'specs.f.nouvelleValeur', type: 'text', placeholderKey: 'specs.ph.dnsValue', required: true },
      { key: 'ttl', labelKey: 'specs.f.ttl', type: 'number', placeholderKey: 'specs.ph.ttl', helperKey: 'specs.help.ttl', min: 0, max: 2147483647, step: 1, validators: ['positiveNumber'], required: true },
      { key: 'scopePool', labelKey: 'specs.f.scopePool', type: 'text', placeholderKey: 'specs.ph.scopePool', required: true },
      { key: 'plageDebut', labelKey: 'specs.f.plageDebut', type: 'text', placeholderKey: 'specs.ph.adresseIp', errorKey: 'specs.ipv4Invalid', validators: ['ipv4'], required: true },
      { key: 'plageFin', labelKey: 'specs.f.plageFin', type: 'text', placeholderKey: 'specs.ph.adresseIp', errorKey: 'specs.ipv4Invalid', validators: ['ipv4'], required: true },
      { key: 'plageAdresses', labelKey: 'specs.f.plageAdresses', type: 'textarea', placeholderKey: 'specs.ph.addressRange', helperKey: 'specs.help.legacyRange', rows: 2, fullWidth: true },
      { key: 'reservation', labelKey: 'specs.f.reservation', type: 'textarea', placeholderKey: 'specs.ph.reservation', rows: 2, fullWidth: true },
      { key: 'reseauDestination', labelKey: 'specs.f.reseauDestination', type: 'text', placeholderKey: 'specs.ph.reseauCidr', errorKey: 'specs.cidrInvalid', validators: ['cidr'], required: true },
      { key: 'nextHop', labelKey: 'specs.f.nextHop', type: 'text', placeholderKey: 'specs.ph.adresseIp', errorKey: 'specs.ipv4Invalid', validators: ['ipv4'], required: true },
      { key: 'metrique', labelKey: 'specs.f.metrique', type: 'number', placeholderKey: 'specs.ph.metric', validators: ['positiveInteger'], min: 1, max: 65535, step: 1, required: true },
      { key: 'protocoleRoutage', labelKey: 'specs.f.protocoleRoutage', type: 'select', options: [option('Statique', 'specs.option.staticRoute'), option('OSPF', 'specs.option.ospf'), option('BGP', 'specs.option.bgp'), option('IS-IS', 'specs.option.isis')], required: true },
      { key: 'typeVpn', labelKey: 'specs.f.typeVpn', type: 'select', options: [option('Site-à-site', 'specs.option.siteToSite'), option('Accès distant', 'specs.option.remoteAccess'), option('SSL VPN', 'specs.option.sslVpn'), option('IPsec', 'specs.option.ipsec'), option('IPSec', 'specs.option.ipsec'), option('WireGuard', 'specs.option.wireguard'), option('Autre', 'form.autre')], required: true },
      { key: 'typeVpnPrecision', labelKey: 'specs.f.typeVpnPrecision', type: 'text', placeholderKey: 'specs.ph.vpnPrecision', required: true, visibleWhen: when('reseau.typeVpn', ['Autre']) },
      { key: 'protocoleVpn', labelKey: 'specs.f.protocoleVpn', type: 'select', options: [option('IPsec', 'specs.option.ipsec'), option('OpenVPN', 'specs.option.openVpn'), option('WireGuard', 'specs.option.wireguard'), option('TCP', 'specs.option.tcp'), option('UDP', 'specs.option.udp'), option('Autre', 'form.autre')], helperKey: 'specs.help.vpnProtocol', required: true },
      { key: 'protocoleVpnPrecision', labelKey: 'specs.f.protocoleVpnPrecision', type: 'text', placeholderKey: 'specs.ph.vpnPrecision', required: true, visibleWhen: when('reseau.protocoleVpn', ['Autre']) },
      { key: 'reseauLocal', labelKey: 'specs.f.reseauLocal', type: 'text', placeholderKey: 'specs.ph.reseauCidr', errorKey: 'specs.cidrInvalid', validators: ['cidr'], required: true },
      { key: 'reseauDistant', labelKey: 'specs.f.reseauDistant', type: 'text', placeholderKey: 'specs.ph.reseauCidr', errorKey: 'specs.cidrInvalid', validators: ['cidr'], required: true },
      { key: 'chiffrementVpn', labelKey: 'specs.f.chiffrementVpn', type: 'select', options: [option('AES-256-GCM', 'specs.option.aes256'), option('AES-256-CBC', 'specs.option.aes256Cbc'), option('ChaCha20-Poly1305', 'specs.option.chacha20'), option('Autre', 'form.autre')], required: true },
      { key: 'chiffrementVpnPrecision', labelKey: 'specs.f.chiffrementVpnPrecision', type: 'text', placeholderKey: 'specs.ph.encryptionPrecision', required: true, visibleWhen: when('reseau.chiffrementVpn', ['Autre']) },
      { key: 'methodeAuth', labelKey: 'specs.f.methodeAuth', type: 'select', options: [option('Certificat', 'specs.option.certificate'), option('Clé pré-partagée', 'specs.option.preSharedKey'), option('MFA', 'specs.option.mfa'), option('Autre', 'form.autre')], required: true },
      { key: 'methodeAuthPrecision', labelKey: 'specs.f.methodeAuthPrecision', type: 'text', placeholderKey: 'specs.ph.authPrecision', required: true, visibleWhen: when('reseau.methodeAuth', ['Autre']) },
      { key: 'peerGateway', labelKey: 'specs.f.peerGateway', type: 'text', placeholderKey: 'specs.ph.gateway', helperKey: 'specs.help.ipOrHostname', errorKey: 'specs.hostInvalid', validators: ['hostnameOrIpv4'], required: true },
      { key: 'portVpn', labelKey: 'specs.f.portVpn', type: 'number', placeholderKey: 'specs.ph.port', helperKey: 'specs.help.port', errorKey: 'specs.portInvalid', validators: ['port'], min: 1, max: 65535, step: 1, visibleWhen: when('reseau.protocoleVpn', ['OpenVPN', 'TCP', 'UDP']) },
      { key: 'typeLb', labelKey: 'specs.f.typeLb', type: 'select', options: [option('L4', 'specs.option.l4'), option('L7', 'specs.option.l7'), option('Application', 'specs.option.applicationLb')], required: true },
      { key: 'vip', labelKey: 'specs.f.vip', type: 'text', placeholderKey: 'specs.ph.ipOrHostname', errorKey: 'specs.hostInvalid', validators: ['hostnameOrIpv4'], required: true },
      { key: 'serveursBackend', labelKey: 'specs.f.serveursBackend', type: 'textarea', placeholderKey: 'specs.ph.backendServers', helperKey: 'specs.help.backendServers', rows: 3, fullWidth: true, required: true },
      { key: 'portsLb', labelKey: 'specs.f.portsLb', type: 'text', placeholderKey: 'specs.ph.portList', helperKey: 'specs.help.portList', errorKey: 'specs.portListInvalid', validators: ['portList'], required: true },
      { key: 'protocoleLb', labelKey: 'specs.f.protocoleLb', type: 'select', options: [option('TCP', 'specs.option.tcp'), option('UDP', 'specs.option.udp'), option('HTTP', 'specs.option.http'), option('HTTPS', 'specs.option.https')], required: true },
      { key: 'algorithmeLb', labelKey: 'specs.f.algorithmeLb', type: 'select', options: [option('Round Robin', 'specs.option.roundRobin'), option('Least Connections', 'specs.option.leastConnections'), option('IP Hash', 'specs.option.ipHash')], required: true },
      { key: 'healthCheck', labelKey: 'specs.f.healthCheck', type: 'text', placeholderKey: 'specs.ph.healthCheck' },
      { key: 'nomSwitch', labelKey: 'specs.f.nomSwitch', type: 'text', placeholderKey: 'specs.ph.switchName', required: true },
      { key: 'ipManagement', labelKey: 'specs.f.ipManagement', type: 'text', placeholderKey: 'specs.ph.adresseIp', errorKey: 'specs.ipv4Invalid', validators: ['ipv4'], required: true },
      { key: 'interfacePort', labelKey: 'specs.f.interfacePort', type: 'text', placeholderKey: 'specs.ph.interface', required: true },
      { key: 'configRequise', labelKey: 'specs.f.configRequise', type: 'textarea', placeholderKey: 'specs.ph.configuration', rows: 3, fullWidth: true },
      { key: 'ssid', labelKey: 'specs.f.ssid', type: 'text', placeholderKey: 'specs.ph.ssid', required: true },
      { key: 'modeSecurite', labelKey: 'specs.f.modeSecurite', type: 'select', options: [option('Ouvert', 'specs.option.open'), option('WPA2-Personal', 'specs.option.wpa2Personal'), option('WPA3-Personal', 'specs.option.wpa3Personal'), option('WPA2-Enterprise', 'specs.option.wpa2Enterprise'), option('WPA3-Enterprise', 'specs.option.wpa3Enterprise')], required: true },
      { key: 'authentificationWifi', labelKey: 'specs.f.authentificationWifi', type: 'select', options: [option('PSK', 'specs.option.psk'), option('802.1X / RADIUS', 'specs.option.radius'), option('Aucune', 'specs.option.none')], required: true },
      { key: 'accessPoint', labelKey: 'specs.f.accessPoint', type: 'text', placeholderKey: 'specs.ph.accessPoint', required: true },
      { key: 'typeProxy', labelKey: 'specs.f.typeProxy', type: 'select', options: [option('Forward', 'specs.option.forwardProxy'), option('Reverse', 'specs.option.reverseProxy'), option('Transparent', 'specs.option.transparentProxy')], required: true },
      { key: 'hostProxy', labelKey: 'specs.f.hostProxy', type: 'text', placeholderKey: 'specs.ph.ipOrHostname', errorKey: 'specs.hostInvalid', validators: ['hostnameOrIpv4'], required: true },
      { key: 'portProxy', labelKey: 'specs.f.portProxy', type: 'number', placeholderKey: 'specs.ph.port', errorKey: 'specs.portInvalid', validators: ['port'], min: 1, max: 65535, step: 1, required: true },
      { key: 'protocoleProxy', labelKey: 'specs.f.protocoleProxy', type: 'select', options: [option('HTTP', 'specs.option.http'), option('HTTPS', 'specs.option.https'), option('SOCKS5', 'specs.option.socks5')], required: true },
      { key: 'servicesCibles', labelKey: 'specs.f.servicesCibles', type: 'textarea', placeholderKey: 'specs.ph.services', rows: 2, fullWidth: true, required: true },
      { key: 'authProxy', labelKey: 'specs.f.authProxy', type: 'select', options: [option('Aucune', 'specs.option.none'), option('Basique', 'specs.option.basicAuth'), option('NTLM', 'specs.option.ntlm'), option('OAuth2', 'specs.option.oauth2')] },
    ],
  },
  {
    id: 'firewall',
    titleKey: 'specs.firewall',
    hintKey: 'specs.firewallHint',
    fields: [
      { key: 'source', labelKey: 'specs.f.source', type: 'text', placeholderKey: 'specs.ph.addressOrZone', helperKey: 'specs.help.addressOrZone', errorKey: 'specs.addressInvalid', validators: ['addressOrZone'], required: true },
      { key: 'destination', labelKey: 'specs.f.destination', type: 'text', placeholderKey: 'specs.ph.addressOrZone', helperKey: 'specs.help.addressOrZone', errorKey: 'specs.addressInvalid', validators: ['addressOrZone'], required: true },
      { key: 'protocole', labelKey: 'specs.f.protocole', type: 'select', options: [option('TCP', 'specs.option.tcp'), option('UDP', 'specs.option.udp'), option('ICMP', 'specs.option.icmp'), option('ESP', 'specs.option.esp'), option('GRE', 'specs.option.gre'), option('Tous', 'specs.option.all')], required: true },
      { key: 'ports', labelKey: 'specs.f.ports', type: 'text', placeholderKey: 'specs.ph.portList', helperKey: 'specs.help.portList', errorKey: 'specs.portListInvalid', validators: ['portList'], visibleWhen: when('firewall.protocole', ['TCP', 'UDP']), required: true },
      { key: 'action', labelKey: 'specs.f.action', type: 'radio', options: [option('Autoriser', 'specs.option.allow'), option('Refuser', 'specs.option.deny'), option('Rejeter', 'specs.option.reject')], required: true },
      { key: 'direction', labelKey: 'specs.f.direction', type: 'select', options: [option('Entrant', 'specs.option.inbound'), option('Sortant', 'specs.option.outbound'), option('Les deux', 'specs.option.both')], required: true },
      { key: 'dureeRegle', labelKey: 'specs.f.dureeRegle', type: 'number', placeholderKey: 'specs.ph.hours', helperKey: 'specs.help.hours', min: 1, max: 8760, step: 1, validators: ['positiveInteger'] },
      { key: 'nat', labelKey: 'specs.f.nat', type: 'radio', options: ouiNon },
      { key: 'zones', labelKey: 'specs.f.zones', type: 'text', placeholderKey: 'specs.ph.zones' },
      { key: 'politique', labelKey: 'specs.f.politique', type: 'select', options: [option('Autoriser', 'specs.option.allow'), option('Refuser', 'specs.option.deny')], required: true },
      { key: 'vpn', labelKey: 'specs.f.vpn', type: 'select', options: [option('Aucun', 'specs.option.none'), option('IPsec', 'specs.option.ipsec'), option('SSL VPN', 'specs.option.sslVpn'), option('WireGuard', 'specs.option.wireguard')] },
      { key: 'justification', labelKey: 'specs.f.justification', type: 'textarea', placeholderKey: 'specs.ph.justification', rows: 3, fullWidth: true, required: true },
      { key: 'reglesPareFeu', labelKey: 'specs.f.reglesPareFeu', type: 'textarea', placeholderKey: 'specs.ph.reglesPareFeu', helperKey: 'specs.help.firewallRules', rows: 3, fullWidth: true },
    ],
  },
  {
    id: 'backup',
    titleKey: 'specs.backup',
    hintKey: 'specs.backupHint',
    fields: [
      { key: 'espaceBackupSupplementaireGo', labelKey: 'specs.f.espaceBackupSupplementaireGo', type: 'number', placeholderKey: 'specs.ph.capacity', min: 1, max: 1048576, step: 1, validators: ['positiveNumber'] },
      { key: 'retentionNombre', labelKey: 'specs.f.retentionNombre', type: 'number', placeholderKey: 'specs.ph.retentionNumber', min: 1, max: 52, step: 1, helperKey: 'specs.help.retention' },
      { key: 'retentionPeriode', labelKey: 'specs.f.retentionPeriode', type: 'select', options: [option('Jour', 'Jour', 'retentionPeriode'), option('Semaines', 'Semaines', 'retentionPeriode'), option('Mois', 'Mois', 'retentionPeriode'), option('Années', 'Années', 'retentionPeriode')] },
      { key: 'frequenceSauvegarde', labelKey: 'specs.f.frequenceSauvegarde', type: 'select', options: [option('Quotidienne', 'Quotidienne', 'frequence'), option('Hebdomadaire', 'Hebdomadaire', 'frequence'), option('Mensuelle', 'Mensuelle', 'frequence'), option('Personnalisée', 'Personnalisée', 'frequence')], required: true },
      { key: 'destinationBackup', labelKey: 'specs.f.destinationBackup', type: 'text', placeholderKey: 'specs.ph.destinationBackup', required: true },
      { key: 'compression', labelKey: 'specs.f.compression', type: 'radio', options: ouiNon },
      { key: 'chiffrement', labelKey: 'specs.f.chiffrement', type: 'radio', options: ouiNon },
      { key: 'licencesNecessaires', labelKey: 'specs.f.licencesNecessaires', type: 'textarea', placeholderKey: 'specs.ph.licenses', rows: 2, fullWidth: true },
      { key: 'sourceBackup', labelKey: 'specs.f.sourceBackup', type: 'text', placeholderKey: 'specs.ph.resourceName', required: true },
      { key: 'pointRestauration', labelKey: 'specs.f.pointRestauration', type: 'text', placeholderKey: 'specs.ph.restorePoint', required: true },
      { key: 'cibleRestore', labelKey: 'specs.f.cibleRestore', type: 'text', placeholderKey: 'specs.ph.restoreTarget', required: true },
      { key: 'typeRestore', labelKey: 'specs.f.typeRestore', type: 'select', options: [option('Complet', 'specs.option.full'), option('Fichiers', 'specs.option.files'), option('Base de données', 'specs.option.database'), option('Bare metal', 'specs.option.bareMetal')], required: true },
      { key: 'perimetreDonnees', labelKey: 'specs.f.perimetreDonnees', type: 'textarea', placeholderKey: 'specs.ph.dataScope', rows: 3, fullWidth: true, required: true },
      { key: 'perimetreBackup', labelKey: 'specs.f.perimetreBackup', type: 'textarea', placeholderKey: 'specs.ph.dataScope', rows: 3, fullWidth: true, required: true },
      { key: 'retentionExistante', labelKey: 'specs.f.retentionExistante', type: 'text', placeholderKey: 'specs.ph.retentionExisting' },
      { key: 'typeReplication', labelKey: 'specs.f.typeReplication', type: 'select', options: [option('Synchrone', 'specs.option.sync'), option('Asynchrone', 'specs.option.async'), option('À la demande', 'specs.option.onDemand')], required: true },
      { key: 'bandePassante', labelKey: 'specs.f.bandePassante', type: 'number', placeholderKey: 'specs.ph.bandwidth', helperKey: 'specs.help.bandwidth', min: 1, max: 1000000, step: 1, validators: ['positiveNumber'], required: true },
      { key: 'rpo', labelKey: 'specs.f.rpo', type: 'number', placeholderKey: 'specs.ph.minutes', helperKey: 'specs.help.rpo', min: 1, max: 525600, step: 1, validators: ['positiveInteger'], required: true },
      { key: 'sourceArchive', labelKey: 'specs.f.sourceArchive', type: 'text', placeholderKey: 'specs.ph.resourceName', required: true },
      { key: 'destinationArchive', labelKey: 'specs.f.destinationArchive', type: 'text', placeholderKey: 'specs.ph.destinationBackup', required: true },
      { key: 'classeStockage', labelKey: 'specs.f.classeStockage', type: 'select', options: [option('Standard', 'specs.option.standard'), option('Infrequent Access', 'specs.option.infrequent'), option('Archive', 'specs.option.archive'), option('Glacier', 'specs.option.glacier')], required: true },
      { key: 'exigencesRecuperation', labelKey: 'specs.f.exigencesRecuperation', type: 'textarea', placeholderKey: 'specs.ph.recoveryRequirements', rows: 3, fullWidth: true },
      { key: 'nomJobVeeam', labelKey: 'specs.f.nomJobVeeam', type: 'text', placeholderKey: 'specs.ph.jobName', required: true },
      { key: 'serveurVeeam', labelKey: 'specs.f.serveurVeeam', type: 'text', placeholderKey: 'specs.ph.host', required: true },
      { key: 'typeBackupVeeam', labelKey: 'specs.f.typeBackupVeeam', type: 'select', options: [option('VM', 'specs.option.vm'), option('Serveur physique', 'specs.option.physicalServer'), option('Poste de travail', 'specs.option.workstation')], required: true },
      { key: 'repository', labelKey: 'specs.f.repository', type: 'text', placeholderKey: 'specs.ph.repository', required: true },
      { key: 'planification', labelKey: 'specs.f.planification', type: 'text', placeholderKey: 'specs.ph.schedule', helperKey: 'specs.help.schedule', required: true },
      { key: 'systemeCible', labelKey: 'specs.f.systemeCible', type: 'text', placeholderKey: 'specs.ph.resourceName', required: true },
      { key: 'typeBackup', labelKey: 'specs.f.typeBackup', type: 'select', options: [option('Complet', 'specs.option.full'), option('Incrémentiel', 'specs.option.incremental'), option('Différentiel', 'specs.option.differential'), option('Log', 'specs.option.log')], required: true },
    ],
  },
  {
    id: 'iaGpu',
    titleKey: 'specs.gpu',
    hintKey: 'specs.gpuHint',
    fields: [
      { key: 'typeGpu', labelKey: 'specs.f.typeGpu', type: 'select', options: [option('NVIDIA H100', 'specs.option.h100'), option('NVIDIA A100', 'specs.option.a100'), option('NVIDIA L40S', 'specs.option.l40s'), option('NVIDIA T4', 'specs.option.t4'), option('AMD MI300X', 'specs.option.mi300x'), option('Autre', 'form.autre')], required: true },
      { key: 'typeGpuPrecision', labelKey: 'specs.f.typeGpuPrecision', type: 'text', placeholderKey: 'specs.ph.gpuModel', required: true, visibleWhen: when('iaGpu.typeGpu', ['Autre']) },
      { key: 'nombreGpu', labelKey: 'specs.f.nombreGpu', type: 'number', placeholderKey: 'specs.ph.gpuCount', min: 1, max: 256, step: 1, validators: ['positiveInteger'], required: true },
      { key: 'vramGo', labelKey: 'specs.f.vramGo', type: 'number', placeholderKey: 'specs.ph.vramGo', min: 1, max: 4096, step: 1, validators: ['positiveNumber'] },
      { key: 'versionCuda', labelKey: 'specs.f.versionCuda', type: 'text', placeholderKey: 'specs.ph.versionCuda', errorKey: 'specs.versionInvalid', validators: ['version'] },
      { key: 'framework', labelKey: 'specs.f.framework', type: 'select', options: [option('PyTorch', 'specs.option.pytorch'), option('TensorFlow', 'specs.option.tensorflow'), option('JAX', 'specs.option.jax'), option('ONNX Runtime', 'specs.option.onnx'), option('Autre', 'form.autre')] },
      { key: 'versionPilote', labelKey: 'specs.f.versionPilote', type: 'text', placeholderKey: 'specs.ph.versionPilote', errorKey: 'specs.versionInvalid', validators: ['version'] },
      { key: 'serveurCible', labelKey: 'specs.f.serveurCible', type: 'text', placeholderKey: 'specs.ph.resourceName', required: true },
      { key: 'dureeEstimee', labelKey: 'specs.f.dureeEstimee', type: 'number', placeholderKey: 'specs.ph.hours', helperKey: 'specs.help.hours', min: 1, max: 8760, step: 1, validators: ['positiveNumber'] },
      { key: 'versionPiloteActuelle', labelKey: 'specs.f.versionPiloteActuelle', type: 'text', placeholderKey: 'specs.ph.versionPilote', errorKey: 'specs.versionInvalid', validators: ['version'], required: true },
      { key: 'versionPiloteDemandee', labelKey: 'specs.f.versionPiloteDemandee', type: 'text', placeholderKey: 'specs.ph.versionPilote', errorKey: 'specs.versionInvalid', validators: ['version'], required: true },
      { key: 'compatibiliteCuda', labelKey: 'specs.f.compatibiliteCuda', type: 'radio', options: ouiNon },
      { key: 'fenetreMaintenance', labelKey: 'specs.f.fenetreMaintenance', type: 'text', placeholderKey: 'specs.ph.maintenanceWindow', required: true },
    ],
  },
  {
    id: 'securite',
    titleKey: 'specs.security',
    hintKey: 'specs.securityHint',
    fields: [
      { key: 'perimetre', labelKey: 'specs.f.perimetre', type: 'text', placeholderKey: 'specs.ph.perimetre', required: true },
      { key: 'niveauCriticite', labelKey: 'specs.f.niveauCriticite', type: 'select', options: [option('Faible', 'specs.option.low'), option('Moyenne', 'specs.option.medium'), option('Haute', 'specs.option.high'), option('Critique', 'specs.option.critical')], required: true },
      { key: 'systemeCible', labelKey: 'specs.f.systemeCible', type: 'text', placeholderKey: 'specs.ph.resourceName', required: true },
      { key: 'environnementAudit', labelKey: 'specs.f.environnementAudit', type: 'select', options: environnements, required: true },
      { key: 'typeAudit', labelKey: 'specs.f.typeAudit', type: 'select', options: [option('Technique', 'specs.option.technicalAudit'), option('Sécurité', 'specs.option.securityAudit'), option('Conformité', 'specs.option.complianceAudit'), option('Vulnérabilités', 'specs.option.vulnerabilityAudit')], required: true },
      { key: 'periodeAudit', labelKey: 'specs.f.periodeAudit', type: 'text', placeholderKey: 'specs.ph.auditPeriod', required: true },
      { key: 'livrables', labelKey: 'specs.f.livrables', type: 'textarea', placeholderKey: 'specs.ph.deliverables', rows: 3, fullWidth: true },
      { key: 'typeCertificat', labelKey: 'specs.f.typeCertificat', type: 'select', options: [option('SSL/TLS', 'specs.option.sslTls'), option('Wildcard', 'specs.option.wildcard'), option('Client', 'specs.option.clientCertificate'), option('S/MIME', 'specs.option.smime')], required: true },
      { key: 'formatCertificat', labelKey: 'specs.f.formatCertificat', type: 'select', options: [option('PEM', 'specs.option.pem'), option('PKCS#12', 'specs.option.pkcs12'), option('DER', 'specs.option.der')], required: true },
      { key: 'nomCommun', labelKey: 'specs.f.nomCommun', type: 'text', placeholderKey: 'specs.ph.domain', helperKey: 'specs.help.domain', required: true },
      { key: 'emetteurCa', labelKey: 'specs.f.emetteurCa', type: 'text', placeholderKey: 'specs.ph.ca' },
      { key: 'validite', labelKey: 'specs.f.validite', type: 'text', placeholderKey: 'specs.ph.validityLegacy', helperKey: 'specs.help.legacyValidity' },
      { key: 'dateExpiration', labelKey: 'specs.f.dateExpiration', type: 'date', helperKey: 'specs.help.expirationDate', required: true },
      { key: 'protocoleSecurite', labelKey: 'specs.f.protocoleSecurite', type: 'select', options: [option('TLS 1.2', 'specs.option.tls12'), option('TLS 1.3', 'specs.option.tls13')], required: true, visibleWhen: when('securite.typeCertificat', ['SSL/TLS', 'Wildcard']) },
      { key: 'cibleInstallation', labelKey: 'specs.f.cibleInstallation', type: 'text', placeholderKey: 'specs.ph.installationTarget', required: true },
      { key: 'renouvellementOuNouveau', labelKey: 'specs.f.renouvellementOuNouveau', type: 'radio', options: [option('Renouvellement', 'specs.option.renewal'), option('Nouveau', 'specs.option.new')], required: true },
    ],
  },
];

export const SPECIFICATION_SECTION_IDS = SPECIFICATION_SECTIONS.map((section) => section.id);

export function fieldsForSection(section: string): SpecificationField[] {
  return SPECIFICATION_SECTIONS.find((item) => item.id === section)?.fields || [];
}

export function sectionFor(section: string): SpecificationSection | undefined {
  return SPECIFICATION_SECTIONS.find((item) => item.id === section);
}

export const STORAGE_FIELDS: SpecificationField[] = [
  { key: 'typeStockage', labelKey: 'specs.f.typeStockage', type: 'select', options: ['NAS', 'SAN', 'DAS', 'Object Storage', 'Block Storage', 'File Storage', 'Cloud Storage', 'Local Storage', 'Autre'].map((v) => option(v, `specs.option.storage.${v}`)), required: true },
  { key: 'customStorageType', labelKey: 'specs.f.customStorageType', type: 'text', placeholderKey: 'specs.ph.customStorageType', required: true, visibleWhen: when('typeStockage', ['Autre']) },
  { key: 'capaciteGo', labelKey: 'specs.f.capaciteGo', type: 'number', placeholderKey: 'specs.ph.capaciteGo', min: 1, max: 1048576, step: 1, validators: ['positiveNumber'], required: true },
  { key: 'protocole', labelKey: 'specs.f.protocole', type: 'select', options: ['NFS', 'SMB / CIFS', 'iSCSI', 'Fibre Channel', 'S3', 'NVMe-oF', 'FTP / SFTP', 'WebDAV', 'Autre'].map((v) => option(v, `specs.option.storageProtocol.${v}`)), required: true },
  { key: 'customProtocole', labelKey: 'specs.f.customProtocole', type: 'text', placeholderKey: 'specs.ph.customProtocole', required: true, visibleWhen: when('protocole', ['Autre']) },
  { key: 'iops', labelKey: 'specs.f.iops', type: 'number', placeholderKey: 'specs.ph.iops', min: 1, max: 100000000, step: 1, validators: ['positiveInteger'] },
  { key: 'throughputMbps', labelKey: 'specs.f.throughputMbps', type: 'number', placeholderKey: 'specs.ph.throughput', min: 1, max: 1000000, step: 1, validators: ['positiveNumber'] },
  { key: 'quotaGo', labelKey: 'specs.f.quotaGo', type: 'number', placeholderKey: 'specs.ph.quota', min: 1, max: 1048576, step: 1, validators: ['positiveNumber'], visibleWhen: (form) => form.parent?.parent?.get('sousCategorie')?.value === 'Quotas' },
  { key: 'replication', labelKey: 'specs.f.replication', type: 'radio', options: ouiNon },
  { key: 'encryption', labelKey: 'specs.f.encryption', type: 'radio', options: ouiNon },
];
