/**
 * Tests du registre SaaS (sans base de données) :
 *   - intégrité des workflows (états, transitions, états terminaux) ;
 *   - permissions référencées par les transitions existent dans le produit ;
 *   - chaque rôle par défaut possède des permissions résolvables ;
 *   - clés de produits uniques et stables.
 */
const assert = require('node:assert');
const {
  PRODUCTS,
  WORKFLOWS,
  getProduct,
  getWorkflow,
  getPermissions,
  rolePermissions,
  PLANS,
} = require('./registry');

let failures = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures += 1;
    console.log(`  ✗ ${name} — ${err.message}`);
  }
};

console.log('Test 1 : clés de produits uniques et stables');
const keys = PRODUCTS.map((p) => p.key);
check('17 produits définis', () => assert.strictEqual(PRODUCTS.length, 17));
check('clés uniques', () => assert.strictEqual(new Set(keys).size, keys.length));
check('clés en snake_case stable', () =>
  keys.forEach((k) => assert.match(k, /^[a-z][a-z0-9_]*$/))
);
check('ServiceDesk disponible', () => assert.strictEqual(getProduct('servicedesk').status, 'available'));
check('Gestion de Projet disponible', () => assert.strictEqual(getProduct('project_management').status, 'available'));
check('deux produits disponibles (ServiceDesk + Gestion de Projet)', () =>
  assert.strictEqual(PRODUCTS.filter((p) => p.available).length, 2)
);
check('produits « bientôt » non disponibles (pas de fausses fonctionnalités)', () =>
  assert.ok(PRODUCTS.filter((p) => p.status === 'coming_soon').every((p) => !p.available))
);
check('route applicative de Gestion de Projet', () =>
  assert.strictEqual(getProduct('project_management').route, '/projets')
);

console.log('Test 2 : plans cohérents (3 plans par produit, prix positifs)');
check('chaque produit a 3 plans', () =>
  PRODUCTS.forEach((p) => assert.strictEqual(p.plans.length, 3))
);
check('prix mensuels > 0 et annuels = 10 × mensuel', () =>
  PRODUCTS.forEach((p) =>
    p.plans.forEach((pl) => {
      assert.ok(pl.pricePerSeatMonthly > 0, `${p.key}/${pl.id} prix mensuel`);
      assert.strictEqual(pl.pricePerSeatAnnual, Math.round(pl.pricePerSeatMonthly * 10));
    })
  )
);

console.log('Test 3 : workflows — intégrité des états et transitions');
for (const p of PRODUCTS) {
  const wf = getWorkflow(p.key);
  check(`workflow défini pour ${p.key}`, () => assert.ok(wf, p.key));
  if (!wf) continue;
  const stateKeys = new Set(wf.states.map((s) => s.key));
  check(`workflow ${p.key} : au moins 2 états`, () => assert.ok(wf.states.length >= 2));
  check(`workflow ${p.key} : états uniques`, () =>
    assert.strictEqual(stateKeys.size, wf.states.length)
  );
  const terminal = wf.states.filter((s) => s.terminal).map((s) => s.key);
  const perms = new Set(getPermissions(p.key));
  for (const tr of wf.transitions) {
    check(`workflow ${p.key} : transition ${tr.from}→${tr.to} (états valides)`, () => {
      if (tr.from !== '*') assert.ok(stateKeys.has(tr.from), `état source ${tr.from} inconnu`);
      assert.ok(stateKeys.has(tr.to), `état cible ${tr.to} inconnu`);
    });
    if (tr.permission) {
      check(`workflow ${p.key} : permission ${tr.permission} déclarée`, () =>
        assert.ok(perms.has(tr.permission), `${tr.permission} absente de ${p.key}`)
      );
    }
  }
  for (const t of terminal) {
    check(`workflow ${p.key} : état terminal ${t} sans transition sortante`, () =>
      assert.ok(!wf.transitions.some((tr) => tr.from === t))
    );
  }
}

console.log('Test 4 : rôles par défaut → permissions résolvables');
for (const p of PRODUCTS) {
  for (const r of p.roles) {
    check(`rôle ${p.key}/${r.key} → permissions non vides`, () =>
      assert.ok(rolePermissions(r.key).length > 0, `${r.key} sans permissions`)
    );
  }
  check(`rôles uniques pour ${p.key}`, () =>
    assert.strictEqual(new Set(p.roles.map((r) => r.key)).size, p.roles.length)
  );
}

console.log('Test 5 : moteur de transitions générique (canTransition)');
const { canTransition } = require('./registry');
const proj = (p) => rolePermissions(p);
check('projet : backlog → todo autorisé (permission)', () =>
  assert.deepStrictEqual(canTransition('project_management', 'backlog', 'todo', proj('project_member')), { ok: true, reason: 'OK' })
);
check('projet : transition non déclarée refusée', () =>
  assert.strictEqual(canTransition('project_management', 'backlog', 'completed', proj('project_member')).ok, false)
);
check('projet : permission manquante refusée (review→completed sans task.complete)', () =>
  assert.strictEqual(canTransition('project_management', 'review', 'completed', ['project.task.read']).reason, 'PERMISSION_DENIED')
);
check('projet : wildcard admin autorisé (permissions [*])', () =>
  assert.deepStrictEqual(canTransition('project_management', 'backlog', 'todo', ['*']), { ok: true, reason: 'OK' })
);
check('crm : won (terminal) sans transition sortante', () =>
  assert.strictEqual(canTransition('crm', 'won', 'new', ['*']).reason, 'TERMINAL_FROM')
);
check('état source inconnu refusé', () =>
  assert.strictEqual(canTransition('crm', 'inexistant', 'new', ['*']).reason, 'UNKNOWN_FROM')
);
check('produit inconnu refusé', () =>
  assert.strictEqual(canTransition('inconnu', 'a', 'b', ['*']).reason, 'UNKNOWN_PRODUCT')
);

console.log('Test 6 : rôle produit par défaut du principal');
const { defaultProductRole } = require('./registry');
check('CLIENT → requester (servicedesk)', () =>
  assert.strictEqual(defaultProductRole('servicedesk', 'AGENT', 'CLIENT'), 'requester')
);
check('TENANT_ADMIN → servicedesk_admin', () =>
  assert.strictEqual(defaultProductRole('servicedesk', 'TENANT_ADMIN', 'UTILISATEUR'), 'servicedesk_admin')
);
check('AGENT → support_n1', () =>
  assert.strictEqual(defaultProductRole('servicedesk', 'AGENT', 'UTILISATEUR'), 'support_n1')
);
check('MANAGER → service_manager', () =>
  assert.strictEqual(defaultProductRole('servicedesk', 'MANAGER', 'UTILISATEUR'), 'service_manager')
);
check('projet : TENANT_ADMIN → project_admin', () =>
  assert.strictEqual(defaultProductRole('project_management', 'TENANT_ADMIN', 'UTILISATEUR'), 'project_admin')
);
check('projet : MANAGER → project_manager', () =>
  assert.strictEqual(defaultProductRole('project_management', 'MANAGER', 'UTILISATEUR'), 'project_manager')
);
check('projet : AGENT → project_lead', () =>
  assert.strictEqual(defaultProductRole('project_management', 'AGENT', 'UTILISATEUR'), 'project_lead')
);
check('projet : VIEWER → project_viewer', () =>
  assert.strictEqual(defaultProductRole('project_management', 'VIEWER', 'UTILISATEUR'), 'project_viewer')
);

console.log('\nRésultat : ' + (failures ? `${failures} échec(s)` : 'OK — registre SaaS valide'));
process.exit(failures ? 1 : 0);
