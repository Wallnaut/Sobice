Za pokretanje je potrebno imati instaliran yarn.
Iz ovog direkotrijuma (/Sobice/) se pokrece:
- prvo 'yarn' - za povlacenje paketa
- zatim 'yarn start'
Server ce biti na 'localhost:4000'

Kada se server pokrene, otvoriti localhost iz vise tabova, log out, promeniti korisnike, ucestvovati u komunikaciji.
Kada se korisnik izloguje, njegov online key iz base se brise, balonce posivi i clanovi General chata se obaveste. Kada se uloguje, obrnut proces.

Glavne redis komande u index.js u rutama.
Pokretanjem redis-cli moze se pogledati i baza.

Korisnici se pre svega dodaju koristeci createDemoData() funkcije


Inicijalizacija
Radi jednostavnosti, proverava se ključ sa total_users vrednošću: ako ne postoji, popunjavamo Redis bazu podataka početnim podacima. EXISTS total_users (proverava da li ključ postoji)

Pokretanje demo podataka vrši se u više koraka:

Kreiranje demo korisnika: Kreiramo novi korisnički ID: INCR total_users. Zatim postavljamo ključ za traženje korisničkog ID -a prema korisničkom imenu: npr. SET korisničko ime: nadimak: 1. I na kraju, ostatak podataka se upisuje u heš skup: npr. HSET korisnik: 1 korisničko ime "nadimak" lozinka "bcript_hashed_passvord".

Osim toga, svaki korisnik se dodaje u podrazumevanu prostoriju "Opšte". Za rukovanje prostorijama za svakog korisnika, imamo set koji sadrži identifikatore soba. Evo primera komande kako dodati sobu: npr. SADD user:1:sobe "0".

Popunite privatne poruke između korisnika. Prvo se stvaraju privatne sobe: ako je potrebno uspostaviti privatnu sobu, za svakog korisnika generiše se ID sobe: room:1:2, gde brojevi odgovaraju ID-jevima korisnika u rastućem redosledu.

Na primer. Napravite privatnu sobu između 2 korisnika: SADD user:1:rooms 1:2 i SADD user:2:rooms 1:2.

Zatim ovoj sobi dodajemo poruke pisanjem u sortirani skup:

Na primer. ZADD room: 1:2 1615480369 "{'from': 1, 'date': 1615480369, 'message': 'Hello', 'roomId': '1: 2'}".

Koristimo strogi JSON za čuvanje strukture poruka i pojednostavljenje detalja implementacije za aplikaciju.

Popunite prostoriju „Opšte“ porukama. Poruke se dodaju u sortirani skup sa ID -om sobe "General":room:0

U toku: dodavanje dugmadi za dodavanje korisnika, zahtevanje privatne sobe, itd. Ne samo preko baze.