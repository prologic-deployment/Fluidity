/**
 * E2E SÉCURITÉ UPLOADS — UPL-001 (types), UPL-002 (restitution durcie),
 * UPL-003 (quota). MongoMemoryServer dédié.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const path = require('path');
const mongoose = require('mongoose');
const fs = require('fs');

let failures = 0;
const check = (name, ok, extra = '') => {
  if (ok) console.log(`  ✓ ${name}`);
  else { failures += 1; console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`); }
};

const PNG_REEL = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 1),
]);
const PDF_REEL = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(64, 2)]);
const JS_DEGUISE = Buffer.from('alert("xss"); // pas une image');

(async () => {
  const mongod = await MongoMemoryServer.create({ binary: { version: '7.0.14' }, instance: { storageEngine: 'wiredTiger' } });
  process.env.MONGO_URI = mongod.getUri('fluidity_uploads_e2e');
  process.env.JWT_SECRET = 'e2e-uploads-jwt-secret-0123456789abcdef';
  process.env.JWT_EXPIRES_IN = '15m';
  process.env.TWO_FACTOR_ENCRYPTION_KEY = 'e2e-two-factor-encryption-key-0123456789abcdef';
  const { runSeed } = require(path.join(__dirname, '..', 'src', 'seed', 'run'));
  await runSeed();
  await mongoose.connect(process.env.MONGO_URI);
  const app = require(path.join(__dirname, '..', 'src', 'app'));
  const server = app.listen(3107, '127.0.0.1', async () => {
    const base = 'http://127.0.0.1:3107';
    try {
      const login = async (email) =>
        (await (await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Password123!' }) })).json()).token;
      const token = await login('admin@fluidity.dev');
      check('connexion admin', !!token);

      const upload = async (nom, contenu, mime) => {
        const fd = new FormData();
        fd.append('files', new Blob([contenu], { type: mime }), nom);
        const res = await fetch(`${base}/api/uploads/attachments`, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token },
          body: fd,
        });
        let data = {};
        try { data = await res.json(); } catch { /* vide */ }
        return { status: res.status, data };
      };

      // ------------------------------------------------ types autorisés
      const pngOk = await upload('logo.png', PNG_REEL, 'image/png');
      check('PNG valide accepté (201)', pngOk.status === 201 && !!pngOk.data.files?.[0]?.url, String(pngOk.status));
      const pdfOk = await upload('rapport.pdf', PDF_REEL, 'application/pdf');
      check('PDF valide accepté (201)', pdfOk.status === 201, String(pdfOk.status));

      // ------------------------------------------------ mensonge de contenu
      const menteur = await upload('image.png', JS_DEGUISE, 'image/png');
      check('PNG au contenu JavaScript refusé (415 magic bytes)', menteur.status === 415, `${menteur.status} ${JSON.stringify(menteur.data)}`);

      // ------------------------------------------------ extensions interdites
      const exe = await upload('outil.exe', Buffer.from('MZ\x90\x00'), 'application/octet-stream');
      check('.exe refusé (415 extension)', exe.status === 415, String(exe.status));
      const html = await upload('page.html', Buffer.from('<script>x</script>'), 'text/html');
      check('.html refusé (415 extension)', html.status === 415, String(html.status));
      const js = await upload('script.js', JS_DEGUISE, 'application/javascript');
      check('.js refusé (415 extension)', js.status === 415, String(js.status));

      // ------------------------------------------------ MIME incohérent
      const mimeFaux = await upload('doc.pdf', PDF_REEL, 'image/png');
      check('MIME incohérent avec l’extension refusé (415)', mimeFaux.status === 415, String(mimeFaux.status));

      // ------------------------------------------------ restitution durcie
      if (pngOk.data.files?.[0]?.url) {
        const img = await fetch(base + pngOk.data.files[0].url);
        check('image servie inline (Content-Type png, pas d’attachment)', img.status === 200 && (img.headers.get('content-type') || '').includes('image/png') && !img.headers.get('content-disposition'), img.headers.get('content-type'));
        check('nosniff + CSP sur /uploads', (img.headers.get('x-content-type-options') || '') === 'nosniff' && /default-src 'none'/.test(img.headers.get('content-security-policy') || ''));
      }
      if (pdfOk.data.files?.[0]?.url) {
        const doc = await fetch(base + pdfOk.data.files[0].url);
        check('PDF servi en téléchargement forcé (attachment + octet-stream)', (doc.headers.get('content-disposition') || '').includes('attachment') && (doc.headers.get('content-type') || '').includes('octet-stream'), doc.headers.get('content-disposition'));
      }

      // ------------------------------------------------ quota (UPL-003)
      const { Tenant } = require(path.join(__dirname, '..', 'src', 'models', 'tenant.model'));
      await Tenant.updateOne({ name: 'Fluidity' }, { $set: { storageQuotaMb: 0 } });
      const quota = await upload('encore.png', PNG_REEL, 'image/png');
      check('quota atteint → 413', quota.status === 413 && quota.data.code === 'QUOTA_STOCKAGE_ATTEINT', `${quota.status} ${JSON.stringify(quota.data)}`);
      await Tenant.updateOne({ name: 'Fluidity' }, { $set: { storageQuotaMb: 1024 } });

      // ------------------------------------------------ ménage orphelins (UPL-003)
      const { runUploadsGC } = require(path.join(__dirname, '..', 'src', 'jobs', 'uploads-gc.job'));
      const dossier = path.join(__dirname, '..', 'uploads', 'tenants');
      // fichier orphelin volontairement ancien
      const orphelinDir = fs.existsSync(dossier) ? dossier : null;
      if (orphelinDir) {
        const orphelin = path.join(orphelinDir, 'orphelin-test-ancien.png');
        fs.writeFileSync(orphelin, PNG_REEL);
        const passe = new Date(Date.now() - 60 * 24 * 3600 * 1000);
        fs.utimesSync(orphelin, passe, passe);
        const resultat = await runUploadsGC();
        check('fichier orphelin ancien supprimé par le GC', !fs.existsSync(orphelin) && resultat.supprimes >= 1, JSON.stringify(resultat));
      } else {
        check('fichier orphelin ancien supprimé par le GC', false, 'dossier uploads introuvable');
      }
      // le PNG uploadé et RÉFÉRENCÉ nulle part… est orphelin aussi — vérifions
      // surtout que les fichiers RÉFÉRENCÉS en base survivent :
      const { Utilisateur } = require(path.join(__dirname, '..', 'src', 'models', 'user.model'));
      await Utilisateur.updateOne({ email: 'admin@fluidity.dev' }, { $set: { avatarUrl: pngOk.data.files?.[0]?.url || null } });
      await runUploadsGC();
      const survit = pngOk.data.files?.[0]?.url && fs.existsSync(path.join(__dirname, '..', pngOk.data.files[0].url.replace(/^\//, '')));
      check('fichier référencé (avatar) conservé par le GC', !!survit);
    } catch (err) {
      failures += 1;
      console.error('ERREUR DE DÉROULEMENT :', err);
    } finally {
      server.close();
      await mongoose.disconnect();
      await mongod.stop();
      console.log(failures === 0 ? '\nRésultat : OK — uploads sécurisés.' : `\nRésultat : ${failures} ÉCHEC(S)`);
      process.exit(failures === 0 ? 0 : 1);
    }
  });
})();
