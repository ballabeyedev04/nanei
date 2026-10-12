#!/usr/bin/env bash
# ============================================================
#  Nanei API — test de démarrage d'un backend en service
#
#  Usage : bash scripts/ci/test-demarrage.sh <url de base> <sha attendu>
#  Ex.   : bash scripts/ci/test-demarrage.sh http://127.0.0.1:3000 "$GITHUB_SHA"
#
#  Variables facultatives :
#    ADMIN_EMAIL / ADMIN_PASSWORD : compte admin créé au démarrage (seedAdmin) ;
#      si fournis, une connexion réelle est testée (bcrypt natif, JWT, base).
#    ATTENTE_MAX_S (défaut 120) : délai maximal pour que /health réponde.
#
#  Utilisé par .github/workflows/deploy.yml (étape 4) sur l'image Docker
#  construite, et utilisable en local contre `npm start`.
#  Écrit un tableau dans $GITHUB_STEP_SUMMARY s'il est défini.
#  Code de sortie ≠ 0 au premier contrôle en échec.
# ============================================================
set -euo pipefail

BASE="${1:?url de base manquante}"
SHA_ATTENDU="${2:?sha attendu manquant}"
ATTENTE_MAX_S="${ATTENTE_MAX_S:-120}"
RESUME="${GITHUB_STEP_SUMMARY:-/dev/null}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

ligne() { echo "| $1 | $2 | $3 |" >> "$RESUME"; echo "[$3] $1 — $2"; }
echec() { ligne "$1" "$2" "❌"; echo "::error::Test de démarrage : $1 — $2"; exit 1; }

# Lit un champ d'une réponse JSON (sans jq : node est présent partout où ce
# script tourne).
champ() {
  node -e '
    let d = ""; process.stdin.on("data", (c) => (d += c)).on("end", () => {
      try { const v = JSON.parse(d)[process.argv[1]]; process.stdout.write(v === undefined ? "" : String(v)); }
      catch { process.stdout.write(""); }
    });' "$1" < "$2"
}

# appel <méthode> <chemin> <fichier corps> [données JSON] [jeton] → code HTTP
appel() {
  local methode="$1" chemin="$2" sortie="$3" donnees="${4:-}" jeton="${5:-}"
  local args=(-sS -o "$sortie" -w '%{http_code}' -X "$methode" --max-time 15 "$BASE$chemin")
  [ -n "$donnees" ] && args+=(-H 'Content-Type: application/json' --data "$donnees")
  [ -n "$jeton" ] && args+=(-H "Authorization: Bearer $jeton")
  # En cas d'échec de connexion, curl écrit lui-même « 000 ».
  curl "${args[@]}" 2>/dev/null || true
}

{
  echo ""
  echo "| Contrôle | Résultat | |"
  echo "|---|---|:---:|"
} >> "$RESUME"

# ── 1. /health : 200, base ok, bonne version ────────────────────────────────
debut=$(date +%s)
code=000
while :; do
  code="$(appel GET /health "$TMP_DIR/health.json")"
  [ "$code" = "200" ] && break
  if [ $(( $(date +%s) - debut )) -ge "$ATTENTE_MAX_S" ]; then
    echec "GET /health" "pas de 200 après ${ATTENTE_MAX_S} s (dernier code : $code, corps : $(head -c 200 "$TMP_DIR/health.json" 2>/dev/null || true))"
  fi
  sleep 2
done
duree=$(( $(date +%s) - debut ))
STATUS="$(champ status "$TMP_DIR/health.json")"
DB="$(champ db "$TMP_DIR/health.json")"
VERSION="$(champ version "$TMP_DIR/health.json")"
API="$(champ api "$TMP_DIR/health.json")"
[ "$STATUS" = "OK" ] || echec "GET /health" "status=« $STATUS » (attendu OK)"
[ "$DB" = "ok" ] || echec "GET /health" "db=« $DB » (attendu ok)"
[ "$VERSION" = "$SHA_ATTENDU" ] || echec "GET /health" "version=« $VERSION », attendu « $SHA_ATTENDU »"
[[ "$API" =~ ^[0-9]+$ ]] || echec "GET /health" "api=« $API » n'est pas un entier"
ligne "GET /health" "200 en ${duree} s — db ok, version \`${VERSION:0:7}\`, api $API" "✅"

# Rien de technique dans la sonde publique
if grep -qiE 'postgres|sequelize|stack|node_modules|password' "$TMP_DIR/health.json"; then
  echec "GET /health" "la réponse contient un détail technique"
fi

# ── 2. Route publique qui lit la base (taux inséré par une migration) ───────
code="$(appel GET /nanei/pricing/taux-change "$TMP_DIR/taux.json")"
[ "$code" = "200" ] || echec "GET /nanei/pricing/taux-change (publique)" "code $code (attendu 200)"
ligne "GET /nanei/pricing/taux-change (publique)" "200" "✅"

# ── 3. Routes protégées sans jeton : 401 ────────────────────────────────────
for chemin in /nanei/account/me /nanei/admin/liste-utilisateurs; do
  code="$(appel GET "$chemin" "$TMP_DIR/protege.json")"
  [ "$code" = "401" ] || echec "GET $chemin sans jeton" "code $code (attendu 401)"
  ligne "GET $chemin sans jeton" "401" "✅"
done

# ── 4. Route inconnue : 404 sans détail technique ───────────────────────────
code="$(appel GET /nanei/route-inexistante-ci "$TMP_DIR/inconnue.json")"
[ "$code" = "404" ] || echec "GET /nanei/route-inexistante-ci" "code $code (attendu 404)"
ligne "Route inconnue" "404" "✅"

# ── 5. Connexion réelle de l'admin créé au démarrage (facultatif) ───────────
if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  corps="$(node -e 'process.stdout.write(JSON.stringify({ identifiant: process.argv[1], mot_de_passe: process.argv[2] }))' "$ADMIN_EMAIL" "$ADMIN_PASSWORD")"
  code="$(appel POST /nanei/auth/login "$TMP_DIR/login.json" "$corps")"
  [ "$code" = "200" ] || echec "POST /nanei/auth/login (admin)" "code $code (attendu 200)"
  JETON="$(champ token "$TMP_DIR/login.json")"
  [ -n "$JETON" ] || echec "POST /nanei/auth/login (admin)" "pas de jeton dans la réponse"
  code="$(appel GET /nanei/account/me "$TMP_DIR/me.json" "" "$JETON")"
  [ "$code" = "200" ] || echec "GET /nanei/account/me avec jeton" "code $code (attendu 200)"
  ligne "Connexion admin puis /account/me" "200 / 200" "✅"
fi

echo "" >> "$RESUME"
echo "✅ Test de démarrage réussi"
