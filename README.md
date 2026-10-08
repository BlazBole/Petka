# Petka 1.1 — PostgreSQL in uvoz Sloleksa

Slovenska besedna igra: pet črk, osem poskusov, dnevni izziv in neskončno igranje, navodila in statistika brez prijave.

## Zdaj uporabljaj ta način zagona

**Aplikacija teče z `npm run dev` na http://localhost:3002. V Dockerju teče samo Petkina baza.** To je glavni način razvoja v VS Code. Docker zagona aplikacije za zdaj ne potrebuješ.

| Projekt              | Vrata na računalniku |
| -------------------- | -------------------- |
| Tvoj ProRačuni local | 3000 (brez sprememb) |
| Tvoj ProRačuni live  | 3001 (brez sprememb) |
| Petka                | 3002                 |
| PostgreSQL za Petko  | 55432                |

`compose.yaml` določa projekt `petka`, lastni servis `db`, bazo/uporabnika `petka` in svoj volume. Uporaba iste Docker slike postgres kot v drugem projektu NE pomeni uporabe istih podatkov.

## 1. Nadgradnja iz prejšnjega ZIP-a

1. V terminalu stare Petke ustavi `npm run dev` s Ctrl+C.
2. Razširi novi ZIP v **novo mapo**, npr. `C:\Projekti\Petka-1.1`. V VS Code odpri notranjo mapo `petka`, kjer je `package.json`.
3. Vanjo kopiraj svojo obstoječo `.env.local` iz prejšnje Petke. **Ohrani svoj GAME_SECRET.** Sprememba ključa razveljavi stare igralne žetone. Prejšnjo mapo ohrani kot kopijo.
4. Napredek/statistika sta v brskalniku. Z uporabo istega brskalnika in naslova http://localhost:3002 ostaneta ohranjena; sprememba mape na disku na to ne vpliva.

Novi ZIP ne vsebuje tvojih gesel. Če si medtem sam spreminjal kodo v stari mapi, prenesi tudi te spremembe oziroma primerjaj datoteke pred zamenjavo.

## 2. Namesti odvisnosti

Odpri Terminal → New Terminal v VS Code, v mapi s `package.json`:

```powershell
npm ci
```

Potrebuješ Node.js 24 LTS. Docker Desktop mora biti zagnan (Linux kontejnerji). Če PowerShell blokira `npm.ps1`, uporabi `npm.cmd` ali terminal Command Prompt.

## 3. Ustvari `.env` za bazo

`.env.local` ohrani iz stare različice. Poleg nje ustvari še `.env`:

```powershell
Copy-Item .env.example .env
```

Če `.env` že obstaja, ga ne kopiraj znova; dopolni ga. Command Prompt: `copy .env.example .env`. Linux/macOS: `cp .env.example .env`.

Odpri `.env` in nastavi:

```dotenv
GAME_SECRET=PRILEPI_SVOJ_OBSTOJECI_GAME_SECRET
WORD_SOURCE=postgres
PGHOST=127.0.0.1
PGPORT=55432
PGDATABASE=petka
PGUSER=petka
PGPASSWORD=PRILEPI_NOVO_NAKLJUCNO_GESLO
```

Vrednosti z velikimi opisnimi napisi so mesta za tvoje vrednosti, ne prava gesla. Za novo geslo baze uporabi:

```powershell
node -e "console.log(require('node:crypto').randomBytes(24).toString('hex'))"
```

`GAME_SECRET` v `.env` naj bo **isti kot v obstoječi `.env.local`**. Za nov projekt brez starega ključa ga ustvari z enakim ukazom. Geslo baze in ključ igre naj bosta različna.

Next.js in skripte berejo `.env.local` pred `.env`. V `.env.local` zato ohrani samo obstoječi `GAME_SECRET`; če ima tudi PG\* ali WORD_SOURCE nastavitve, jih odstrani ali uskladi z `.env`. Docker Compose bere `.env`, ne `.env.local`.

Gesla baze ne menjaj zgolj v `.env`, ko je baza že ustvarjena: Docker ob obstoječem volumnu ne spremeni gesla uporabnika. Takrat ga je treba spremeniti tudi v PostgreSQL.

## 4. Zaženi samo Petkino bazo

```powershell
npm run db:up
```

Nato poglej stanje:

```powershell
docker compose ps db
```

Ko je `healthy`, pripravi tabele in začetni izbor:

```powershell
npm run db:init
```

Ukaz lahko varno ponoviš: ničesar ne briše, ne podvoji besed in ne prepiše tvojih uredniških nastavitev. Vse tabele so v shemi `petka`. Skripte zavrnejo drugo ime baze kot `petka`.

Če je 55432 zaseden, v `.env` izberi drugo prosto številko (npr. 55433), nato ponovno `npm run db:up`. S tem se hkrati spremeni Docker preslikava in lokalna povezava aplikacije. Vrata 5432 znotraj kontejnerja ostanejo ista. Ne spreminjaj ProRačunov.

Ob prvem `db:init` se današnji izziv izračuna z istim ključem in začetnim seznamom kot v1.0 ter shrani v bazo. Tako se ob ohranjenem ključu današnja rešitev ne spremeni. Naslednji dnevi se izberejo in trajno shranijo ob prvem obisku tistega dne.

## 5. Uvozi svoj celotni Sloleks ZIP

ZIP lahko ostane v Downloads; ne kopiraj ga v kodo in ga ni treba razširjati. Pot spodaj zamenjaj s svojo dejansko potjo.

Najprej **predogled brez pisanja v bazo**:

```powershell
npm run import:sloleks -- "C:\Users\Blaz\Downloads\Sloleks.3.1.zip" --dry-run
```

Uvoznik prebere celoten ZIP in izpiše število vnosov ter različnih primernih besed. Ustvari:

- `imports/report.json`: število prebranih datotek/vnosov in povzetek filtriranja;
- `imports/allowed-words.csv`: vse uvožene dovoljene oblike in metapodatki;
- `imports/candidates.csv`: samo osnovne imenovalniške oblike občnih samostalnikov, razvrščene po pogostosti, za pregled rešitev. Nedoločniki in druge glagolske oblike niso kandidati.

Nato dejanski uvoz:

```powershell
npm run import:sloleks -- "C:\Users\Blaz\Downloads\Sloleks.3.1.zip"
```

Prebere ZIP še enkrat, nato vse besede v eni transakciji uvozi ali posodobi. Ob napaki pred zaključkom se transakcija razveljavi. Ponovni uvoz ne podvoji besed. Dnevnih izzivov, potrjenih rešitev in ročnih prepovedi ne spreminja.

Uvoz lahko traja več minut: stisnjenih 262 MB predstavlja precej več XML podatkov. Med branjem izpisuje napredek po datotekah. Ne zapiraj terminala. V pomnilniku hrani trenutni XML vnos in seznam petčrkovnih besed, ne celotne zbirke XML. Veljavna alternativa ZIP-u je pot do razširjene mape ali ene celotne XML datoteke.

Poslani `vzorec.txt` se konča z `...` in nima zaključnih XML elementov. Uporabljen je bil za pregled strukture, **ne uporabi ga za dejanski uvoz**. Uvoznik nepopoln XML zavrne, da ti ne uvozi tihega delnega rezultata.

## 6. Zaženi igro

```powershell
npm run dev
```

Odpri **http://localhost:3002**. Vrata 3002 so zdaj že v skripti; dodatka `-- --port 3002` ne potrebuješ. Po uvozu in novi zahtevi igre se v nogi pokaže povezava na Sloleks.

Ob naslednjem delu zadošča: zaženi Docker Desktop, `npm run db:up`, nato `npm run dev`. `db:init` in uvoza ni treba vsakokrat ponavljati.

Za ustavitev aplikacije: Ctrl+C. Za ustavitev samo Petkine baze: `npm run db:stop`. Podatki ostanejo v volumnu. `docker compose down` odstrani Petkine kontejnerje, vendar ohrani podatkovni volume; **`down -v` podatke izbriše**, zato tega ne uporabljaj pri običajnem ustavljanju.

## Kako se besede filtrirajo

- Bere se samo `entry/body/wordFormList/wordForm/formRepresentations/orthographyList/orthography/form`.
- Naglasne oblike in fonetični zapisi (IPA, SAMPA) se ne uvažajo.
- Unicode se normalizira v NFC, zapis v velike črke; ohranjene so samo besede s petimi črkami slovenske abecede, vključno s Č, Š in Ž. Q/W/X/Y, presledki, ločila in številke odpadejo.
- Lastna imena se izločijo po `grammarFeature name="type"` z vrednostjo `proper`. Tako odpadeta tudi Watzman in Čilpe iz poslanih vzorcev.
- Izločijo se kategoriji `abbreviation` in `residual`, oznake izgovora Acronym/Abbreviation/Symbol ter večbesedne leksikalne enote.
- Izločijo se leme in zapisi z `norm`, ki ni prazen ali `standard`. Tudi neznana neprazna oznaka se konservativno izloči; oznake na preverjenih oblikah so navedene v poročilu.
- MANUAL in AUTOMATIC se oba obdelata. Ti oznaki nista splošno zagotovilo pravilnosti besede; opis vira ju povezuje predvsem z nastankom in popravki naglasnih oblik.
- Dovoljene so sklanjane/spregane oblike, tudi s frekvenco 0, če prestanejo filtre. To ne pomeni, da bodo izbrane za skrito rešitev.
- Pri ponavljanju pisne oblike po MSD ali lemah vzamemo največjo zabeleženo frekvenco Gigafida 2.0. Ne seštevamo je, da je ne napihnemo. To je pomoč pri razvrščanju, ne nova natančna meritev skupne rabe.

Filtri niso nadomestilo za jezikovni pregled celotnega slovarja. Po pravem uvozu pregledava poročilo in nabor morebitnih spornih oblik.

## Dovoljeni vnosi in skrite rešitve

Uvoz razširi dovoljene vnose. Vnos sme biti pravilna sklanjana ali spregana oblika, tudi nedoločnik; to niso slovnično napačne besede. Pri skritih rešitvah smo se odločili za strožji izbor: občni samostalniki v osnovni imenovalniški obliki. Navadne množinske oblike (npr. ZOBJE iz ZOB) se ne izbirajo, osnovne množinske leme (npr. VRATA) pa so lahko primerne. Nove besede dobijo `is_solution=false`. Za rešitve ostane ožji začetni pregledani izbor Petke. Iz njega so izločene navadne množinske oblike in nekaj manj običajnih besed. S tem se izognemo naključnim redkim oblikam kot dnevnim rešitvam.

Kandidat mora biti označen kot občni samostalnik, zapis mora ustrezati lemi in biti imenovalniška oblika ednine ali osnovne množinske leme. Za prepoznavanje uporabljamo slovnične lastnosti XML ter slovensko oznako JOS/MSD (S, o, število in sklon). Besedna pogostost sama ni dokaz primernosti. Kandidatni podatek se hrani v `is_solution_candidate`; dejanska odobritev je ločena `is_solution`.

Ko bo uvoz končan, pregledava `imports/candidates.csv` in izbrane besede potrdimo za rešitve. To še ni avtomatiziran jezikovni pregled. Baza ima ločeni zastavici `is_allowed` in `is_solution`; ponovni uvoz ju pri obstoječih besedah ohrani.

Dnevna rešitev je v `petka.daily_puzzles`, zato se ob uvozu ali razširitvi izbora ne spremeni. Sočasni prvi obiski istega dne se uskladijo s transakcijsko ključavnico. Pri novih datumih imajo prednost še neuporabljene rešitve, nato najdlje neuporabljene.

## Podatki brez prijave

Statistika in napredek ostajata v brskalniku. PostgreSQL hrani slovar in dnevni koledar; ne ustvari uporabniških računov. Drugi brskalnik ali izbris podatkov omogoči nov začetek. Igralni žetoni so šifrirani in overjeni, vendar zavestno ponavljanje starih veljavnih žetonov ni preprečeno. To ni tekmovalna lestvica z zaščito pred goljufanjem.

`WORD_SOURCE=demo` omogoči stari lokalni slovar brez baze. Pri `WORD_SOURCE=postgres` napaka baze ne povzroči tihega preklopa na drugo dnevno besedo.

## Struktura projekta

| Datoteka                          | Namen                                          |
| --------------------------------- | ---------------------------------------------- |
| `app/page.tsx`, `app/globals.css` | Igralni vmesnik in videz                       |
| `lib/game.ts`                     | Ocenjevanje črk in slovenski datum             |
| `lib/server-game.ts`              | Strežniške igre in zaščiteni žetoni            |
| `lib/words.ts`                    | Poizvedbe po slovarju, dnevna/naključna izbira |
| `lib/db.ts`                       | Povezava s PostgreSQL                          |
| `lib/demo-words.ts`               | Začetni izbor za inicializacijo in demo        |
| `scripts/db-init.ts`              | Vzpostavitev sheme in začetnih besed           |
| `scripts/sloleks-parser.ts`       | Pretočno branje XML in ZIP                     |
| `scripts/import-sloleks.ts`       | Poročilo, predogled in transakcijski uvoz      |
| `database/schema.sql`             | Tabele in indeksi                              |
| `SLOLEKS-NOTICE.txt`              | Navedba vira in licence podatkov               |

## Preverjanje kode

```powershell
npm test
npm run build
npm run typecheck
```

Testi igre in uvoznika uporabljajo majhne sintetične XML/ZIP primere in ne potrebujejo baze. Celotna zbirka Sloleks tukaj ni bila na voljo, zato dejansko število besed dobiš ob svojem uvozu. Testi ne spreminjajo tvoje baze.

## Pozneje: celotna aplikacija v Dockerju

To je alternativa razvojnemu zagonu. Najprej ustavi `npm run dev`, ker oba načina uporabljata vrata 3002. Pred tem moraš opraviti `db:init` in uvoz po zgornjih navodilih.

```powershell
docker compose --profile app up -d --build
```

V kontejnerju aplikacija dostopa do baze na `db:5432`; računalnik dostopa na `127.0.0.1:55432`. Oba kažeta na isto Petkino bazo. Ključ igre za Docker mora biti v `.env`.

Za vrnitev v razvojni način:

```powershell
docker compose stop app
npm run dev
```

Na VPS pred uporabo inicializiraj in uvozi bazo na enak način z Node.js na strežniku ali prenesi njen preverjen pg_dump. Dodaj `DOMAIN=igra.tvoja-domena.si` v `.env`, usmeri DNS in odpri TCP 80/443. Nato:

```bash
docker compose -f compose.yaml -f compose.production.yaml --profile app up -d --build
```

Caddy poskrbi za HTTPS. Baza in aplikacija sta na gostitelju vezani na 127.0.0.1. Podatkovni volume ni varnostna kopija; pred javno objavo nastavi tudi kopije baze na drugo lokacijo. Docker celotne postavitve v okolju izdelave ni bilo mogoče zagnati.

Dodatno so bile poizvedbe za shemo, ponovljen uvoz, ohranitev uredniških zastavic in dnevnih rešitev ter razveljavitev transakcije preverjene na PostgreSQL jedru PGlite. To ne nadomesti preizkusa povezave z Docker PostgreSQL pri tebi.

Slovnične oznake: https://nl.ijs.si/ME/V6/msd/html/msd-sl.html. Word500 navodila ne predpisujejo splošne prepovedi nedoločnikov: https://word500.com/helpen. Strožji izbor samostalnikov za skrite rešitve je pravilo Petke.

Zagon:
docker compose --profile app up -d

Ustavitev:
docker compose --profile app stop
