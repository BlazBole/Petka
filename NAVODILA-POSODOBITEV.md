# Petka – vnos od konca in nova igra

Ta ZIP namestiš čez obstoječi projekt Petka. Vključuje tudi prejšnji svetel meni,
kompaktno tipko za potrditev na telefonu in tipko `_`.

## Namestitev

1. Razširi ZIP v začasno mapo.
2. Mapo `app` kopiraj v koren obstoječega projekta Petka, kjer je `package.json`.
   Potrdi prepis `app/page.tsx` in `app/globals.css`.
3. Če aplikacijo zaganjaš v Dockerju, v terminalu projekta zaženi:

   ```powershell
   docker compose --profile app up -d --build
   ```

   Če uporabljaš `npm run dev`, se vmesnik posodobi samodejno; po potrebi
   ponovno zaženi razvojni strežnik. Ne zaganjaj obeh načinov hkrati.
4. Osveži stran na računalniku oziroma telefonu.

## Vnos besede

Polja niso več klikljiva in ne omogočajo neposrednega urejanja sredine besede.
Vnos dodaja znake na koncu; Backspace oziroma tipka za brisanje odstrani zadnji znak.
Primer: za zamenjavo druge črke v VRATA izbriši A, T, A in R. Ostane V,
za katerim vpišeš novo drugo črko in preostanek besede.
Enter oziroma kljukica potrdi popolno petčrkovno besedo.
Znak `_` ostaja oznaka neznanke v osnutku, pred potrditvijo ga moraš zamenjati.
Tudi neznanko popraviš z brisanjem od konca.

## Neskončni način

Gumb Nova igra pod tipkovnico začne novo igro z novo naključno besedo
in prazno ploščo. Nedokončana igra se zavrže in ne šteje kot poraz ali odigrana igra.
Dnevnega izziva s tem gumbom ni mogoče ponastaviti.

ZIP spreminja samo vmesnik. Baza, Sloleks, .env, podatki za povezavo in
shranjena statistika se ne spreminjajo. Ponovni uvoz besed ni potreben.
Novih odvisnosti ni.

Preverjeno: TypeScript, vseh 13 obstoječih testov in produkcijska gradnja.
Preizkus na pravem telefonu v tem okolju ni bil izveden.
