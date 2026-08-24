const assert = require('node:assert/strict');
const { specificationsSchema } = require('./specifications.schema');

const valid = {
  reseau: {
    typeVpn: 'IPsec',
    protocoleVpn: 'OpenVPN',
    reseauLocal: '192.168.10.0/24',
    reseauDistant: '10.20.0.0/16',
    peerGateway: 'vpn.example.tn',
    portVpn: 443,
    plageDebut: '192.168.10.100',
    plageFin: '192.168.10.200',
  },
  firewall: {
    source: '10.0.0.0/8',
    destination: 'DMZ',
    protocole: 'TCP',
    ports: '443,8000-8010',
  },
  backup: { retentionSouhaitee: '12 Mois', rpo: 30 },
  stockage: [{ typeStockage: 'SAN', protocole: 'iSCSI', capaciteGo: 2000 }],
  iaGpu: { typeGpu: 'NVIDIA A100', versionCuda: '12.4', versionPilote: '550.54.15' },
};

assert.equal(specificationsSchema.safeParse(valid).success, true);
assert.equal(specificationsSchema.safeParse({ reseau: { adresseIp: '999.999.999.999' } }).success, false);
assert.equal(specificationsSchema.safeParse({ reseau: { reseauCidr: '192.168.1.0/33' } }).success, false);
assert.equal(specificationsSchema.safeParse({ reseau: { portVpn: 65536 } }).success, false);
assert.equal(specificationsSchema.safeParse({ firewall: { ports: '443,70000' } }).success, false);
assert.equal(specificationsSchema.safeParse({ backup: { retentionSouhaitee: '13 Mois' } }).success, false);
assert.equal(specificationsSchema.safeParse({ reseau: { plageDebut: '10.0.0.20', plageFin: '10.0.0.10' } }).success, false);
assert.equal(specificationsSchema.safeParse({ stockage: [{ typeStockage: 'Autre', protocole: 'NFS' }] }).success, false);

console.log('[test] specifications : IPv4, CIDR, ports, rétention, plages et stockage OK.');
