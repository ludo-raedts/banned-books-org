-- Bulk repair of slugs corrupted by the pre-Sprint-A buggy toSlug()
-- (no NFD-normalisation step → accented codepoints collapsed into hyphens).
--
-- Subset filter: scripts/filter-nfd-subset.ts — only rows where replaying
-- the historical buggy slug on the current source field exactly reproduces
-- the stored slug. Everything else (editorial, name-order, initials,
-- hand-disambiguated) is intentionally left untouched.
--
-- Each UPDATE pins both id AND current slug so re-running this migration
-- on an already-repaired database is a no-op.
--
-- NOT INCLUDED: 4 author UPDATEs (ids 398, 1487, 3249, 3528) skipped
-- due to duplicate-row collisions on the authors_slug_key UNIQUE index —
-- the target slug is already held by a sibling row representing the same
-- author. Editorial merge of those four pairs is required before the
-- slug fix can be applied. See docs/sprint-a/duplicate-authors-followup.md.

begin;

-- ── Books (21) ─────────────────────────────────────────────────

-- Solo quedó nuestra historia (id 1579)
update books set slug = 'solo-quedo-nuestra-historia'
 where id = 1579 and slug = 'solo-qued-nuestra-historia';

-- Paul Cézanne (id 4301)
update books set slug = 'paul-cezanne'
 where id = 4301 and slug = 'paul-c-zanne';

-- Velázquez (id 4442)
update books set slug = 'velazquez'
 where id = 4442 and slug = 'vel-zquez';

-- Frío cae blanco (id 4965)
update books set slug = 'frio-cae-blanco'
 where id = 4965 and slug = 'fr-o-cae-blanco';

-- La luna dentro de mí (id 4997)
update books set slug = 'la-luna-dentro-de-mi'
 where id = 4997 and slug = 'la-luna-dentro-de-m';

-- La teoría de lo perfecto (id 4998)
update books set slug = 'la-teoria-de-lo-perfecto'
 where id = 4998 and slug = 'la-teor-a-de-lo-perfecto';

-- Téo's Tutu (id 5310)
update books set slug = 'teos-tutu'
 where id = 5310 and slug = 't-os-tutu';

-- ¿Quién es Carmen Sandiego? (id 5338)
update books set slug = 'quien-es-carmen-sandiego'
 where id = 5338 and slug = 'qui-n-es-carmen-sandiego';

-- Arte para niños con 6 grandes artistas (id 5441)
update books set slug = 'arte-para-ninos-con-6-grandes-artistas'
 where id = 5441 and slug = 'arte-para-ni-os-con-6-grandes-artistas';

-- Christmas in México (id 5487)
update books set slug = 'christmas-in-mexico'
 where id = 5487 and slug = 'christmas-in-me-xico';

-- Crepúsculo: un amor peligroso (id 5498)
update books set slug = 'crepusculo-un-amor-peligroso'
 where id = 5498 and slug = 'crep-sculo-un-amor-peligroso';

-- El diario completamente verídico de un Indio a tiempo parcial (id 5529)
update books set slug = 'el-diario-completamente-veridico-de-un-indio-a-tiempo-parcial'
 where id = 5529 and slug = 'el-diario-completamente-ver-dico-de-un-indio-a-tiempo-parcial';

-- El épico fracaso de Arturo Zamora (id 5531)
update books set slug = 'el-epico-fracaso-de-arturo-zamora'
 where id = 5531 and slug = 'el-e-pico-fracaso-de-arturo-zamora';

-- El último héroe del Olimpo (id 5539)
update books set slug = 'el-ultimo-heroe-del-olimpo'
 where id = 5539 and slug = 'el-ltimo-h-roe-del-olimpo';

-- La maldición del Titán (id 5721)
update books set slug = 'la-maldicion-del-titan'
 where id = 5721 and slug = 'la-maldici-n-del-tit-n';

-- La travesía de Santiago (id 5727)
update books set slug = 'la-travesia-de-santiago'
 where id = 5727 and slug = 'la-traves-a-de-santiago';

-- Lotería (id 5741)
update books set slug = 'loteria'
 where id = 5741 and slug = 'loteri-a';

-- Mär: Märchen Awakens Romance (Series, Title Not Specified) (id 5757)
update books set slug = 'mar-marchen-awakens-romance-series-title-not-specified'
 where id = 5757 and slug = 'm-r-m-rchen-awakens-romance-series-title-not-specified';

-- MeruPuri: Märchen Prince (Series, Title Not Specified) (id 5771)
update books set slug = 'merupuri-marchen-prince-series-title-not-specified'
 where id = 5771 and slug = 'merupuri-m-rchen-prince-series-title-not-specified';

-- Pokémon: Sun & Moon (Series, Title Not Specified) (id 5845)
update books set slug = 'pokemon-sun-moon-series-title-not-specified'
 where id = 5845 and slug = 'poke-mon-sun-moon-series-title-not-specified';

-- Te daría el sol (id 5930)
update books set slug = 'te-daria-el-sol'
 where id = 5930 and slug = 'te-dar-a-el-sol';

-- ── Authors (28) ───────────────────────────────────────────────

-- Yūsei Matsui (id 205)
update authors set slug = 'yusei-matsui'
 where id = 205 and slug = 'y-sei-matsui';

-- Erika L. Sánchez (id 208)
update authors set slug = 'erika-l-sanchez'
 where id = 208 and slug = 'erika-l-s-nchez';

-- André Aciman (id 303)
update authors set slug = 'andre-aciman'
 where id = 303 and slug = 'andr-aciman';

-- Faridah Àbíké-Íyímídé (id 317)
update authors set slug = 'faridah-abike-iyimide'
 where id = 317 and slug = 'faridah-b-k-y-m-d';

-- Pénélope Bagieu (id 780)
update authors set slug = 'penelope-bagieu'
 where id = 780 and slug = 'p-n-lope-bagieu';

-- Renée Ahdieh (id 874)
update authors set slug = 'renee-ahdieh'
 where id = 874 and slug = 'ren-e-ahdieh';

-- Junot Díaz (id 928)
update authors set slug = 'junot-diaz'
 where id = 928 and slug = 'junot-d-az';

-- Alfred Döblin (id 1009)
update authors set slug = 'alfred-doblin'
 where id = 1009 and slug = 'alfred-d-blin';

-- Antoine de Saint-Exupéry (id 1026)
update authors set slug = 'antoine-de-saint-exupery'
 where id = 1026 and slug = 'antoine-de-saint-exup-ry';

-- Elizabeth LaPensée (id 1197)
update authors set slug = 'elizabeth-lapensee'
 where id = 1197 and slug = 'elizabeth-lapens-e';

-- Moïra Fowley-Doyle (id 1291)
update authors set slug = 'moira-fowley-doyle'
 where id = 1291 and slug = 'mo-ra-fowley-doyle';

-- Matt de la Peña (id 1589)
update authors set slug = 'matt-de-la-pena'
 where id = 1589 and slug = 'matt-de-la-pe-a';

-- Kōhei Horikoshi (id 1634)
update authors set slug = 'kohei-horikoshi'
 where id = 1634 and slug = 'k-hei-horikoshi';

-- Lesléa Newman (id 2106)
update authors set slug = 'leslea-newman'
 where id = 2106 and slug = 'lesl-a-newman';

-- Máel Embser-Herbert (id 2184)
update authors set slug = 'mael-embser-herbert'
 where id = 2184 and slug = 'm-el-embser-herbert';

-- Alyson Noël (id 2560)
update authors set slug = 'alyson-noel'
 where id = 2560 and slug = 'alyson-no-l';

-- Bastien Vivès (id 2838)
update authors set slug = 'bastien-vives'
 where id = 2838 and slug = 'bastien-viv-s';

-- Jean-Noël Fabiani (id 2864)
update authors set slug = 'jean-noel-fabiani'
 where id = 2864 and slug = 'jean-no-l-fabiani';

-- Gō Ikeyamada (id 2923)
update authors set slug = 'go-ikeyamada'
 where id = 2923 and slug = 'g-ikeyamada';

-- Patrick Süskind (id 3271)
update authors set slug = 'patrick-suskind'
 where id = 3271 and slug = 'patrick-s-skind';

-- Marie des Neiges Léonard (id 3325)
update authors set slug = 'marie-des-neiges-leonard'
 where id = 3325 and slug = 'marie-des-neiges-l-onard';

-- Zoraida Córdova (id 3542)
update authors set slug = 'zoraida-cordova'
 where id = 3542 and slug = 'zoraida-c-rdova';

-- Cristina García (id 3579)
update authors set slug = 'cristina-garcia'
 where id = 3579 and slug = 'cristina-garc-a';

-- Seán Michael Wilson (id 3627)
update authors set slug = 'sean-michael-wilson'
 where id = 3627 and slug = 'sea-n-michael-wilson';

-- Miyoshi Tōmori (id 3649)
update authors set slug = 'miyoshi-tomori'
 where id = 3649 and slug = 'miyoshi-to-mori';

-- Yūki Tabata (id 3722)
update authors set slug = 'yuki-tabata'
 where id = 3722 and slug = 'yu-ki-tabata';

-- Enric Jardí (id 3759)
update authors set slug = 'enric-jardi'
 where id = 3759 and slug = 'enric-jard';

-- Yūma Andō (id 4047)
update authors set slug = 'yuma-ando'
 where id = 4047 and slug = 'yu-ma-ando';

commit;
