// 301 redirects from the old (NFD-bug) slugs to the corrected slugs.
//
// Generated alongside supabase/migrations/20260512065936_bulk_nfd_slug_fix.sql
// from the NFD-bug subset of scripts/audit-slugs.ts. Each entry is a
// mechanical NFD repair, not an editorial rename — so a permanent (301)
// redirect is correct: the old URL must never resolve to the same page
// again, search engines should treat the new URL as canonical, and
// inbound links from elsewhere on the web survive.
//
// NOT INCLUDED: 4 author redirects (ids 398, 1487, 3249, 3528) intentionally
// excluded — those rows have duplicate siblings in the authors table that
// already hold the target slug. Auto-redirecting would silently hide the
// duplicate-row data-quality issue behind a 301 and re-route traffic to
// the sibling pages. See docs/sprint-a/duplicate-authors-followup.md.
//
// Keep this file the single source of truth: if the migration changes,
// regenerate both together.

import type { NextConfig } from 'next'

type Redirect = NonNullable<Awaited<ReturnType<NonNullable<NextConfig['redirects']>>>>[number]

export const NFD_REDIRECTS: Redirect[] = [
  // Solo quedó nuestra historia (id 1579)
  { source: '/books/solo-qued-nuestra-historia', destination: '/books/solo-quedo-nuestra-historia', permanent: true },
  // Paul Cézanne (id 4301)
  { source: '/books/paul-c-zanne', destination: '/books/paul-cezanne', permanent: true },
  // Velázquez (id 4442)
  { source: '/books/vel-zquez', destination: '/books/velazquez', permanent: true },
  // Frío cae blanco (id 4965)
  { source: '/books/fr-o-cae-blanco', destination: '/books/frio-cae-blanco', permanent: true },
  // La luna dentro de mí (id 4997)
  { source: '/books/la-luna-dentro-de-m', destination: '/books/la-luna-dentro-de-mi', permanent: true },
  // La teoría de lo perfecto (id 4998)
  { source: '/books/la-teor-a-de-lo-perfecto', destination: '/books/la-teoria-de-lo-perfecto', permanent: true },
  // Téo's Tutu (id 5310)
  { source: '/books/t-os-tutu', destination: '/books/teos-tutu', permanent: true },
  // ¿Quién es Carmen Sandiego? (id 5338)
  { source: '/books/qui-n-es-carmen-sandiego', destination: '/books/quien-es-carmen-sandiego', permanent: true },
  // Arte para niños con 6 grandes artistas (id 5441)
  { source: '/books/arte-para-ni-os-con-6-grandes-artistas', destination: '/books/arte-para-ninos-con-6-grandes-artistas', permanent: true },
  // Christmas in México (id 5487)
  { source: '/books/christmas-in-me-xico', destination: '/books/christmas-in-mexico', permanent: true },
  // Crepúsculo: un amor peligroso (id 5498)
  { source: '/books/crep-sculo-un-amor-peligroso', destination: '/books/crepusculo-un-amor-peligroso', permanent: true },
  // El diario completamente verídico de un Indio a tiempo parcial (id 5529)
  { source: '/books/el-diario-completamente-ver-dico-de-un-indio-a-tiempo-parcial', destination: '/books/el-diario-completamente-veridico-de-un-indio-a-tiempo-parcial', permanent: true },
  // El épico fracaso de Arturo Zamora (id 5531)
  { source: '/books/el-e-pico-fracaso-de-arturo-zamora', destination: '/books/el-epico-fracaso-de-arturo-zamora', permanent: true },
  // El último héroe del Olimpo (id 5539)
  { source: '/books/el-ltimo-h-roe-del-olimpo', destination: '/books/el-ultimo-heroe-del-olimpo', permanent: true },
  // La maldición del Titán (id 5721)
  { source: '/books/la-maldici-n-del-tit-n', destination: '/books/la-maldicion-del-titan', permanent: true },
  // La travesía de Santiago (id 5727)
  { source: '/books/la-traves-a-de-santiago', destination: '/books/la-travesia-de-santiago', permanent: true },
  // Lotería (id 5741)
  { source: '/books/loteri-a', destination: '/books/loteria', permanent: true },
  // Mär: Märchen Awakens Romance (Series, Title Not Specified) (id 5757)
  { source: '/books/m-r-m-rchen-awakens-romance-series-title-not-specified', destination: '/books/mar-marchen-awakens-romance-series-title-not-specified', permanent: true },
  // MeruPuri: Märchen Prince (Series, Title Not Specified) (id 5771)
  { source: '/books/merupuri-m-rchen-prince-series-title-not-specified', destination: '/books/merupuri-marchen-prince-series-title-not-specified', permanent: true },
  // Pokémon: Sun & Moon (Series, Title Not Specified) (id 5845)
  { source: '/books/poke-mon-sun-moon-series-title-not-specified', destination: '/books/pokemon-sun-moon-series-title-not-specified', permanent: true },
  // Te daría el sol (id 5930)
  { source: '/books/te-dar-a-el-sol', destination: '/books/te-daria-el-sol', permanent: true },
  // Yūsei Matsui (id 205)
  { source: '/authors/y-sei-matsui', destination: '/authors/yusei-matsui', permanent: true },
  // Erika L. Sánchez (id 208)
  { source: '/authors/erika-l-s-nchez', destination: '/authors/erika-l-sanchez', permanent: true },
  // André Aciman (id 303)
  { source: '/authors/andr-aciman', destination: '/authors/andre-aciman', permanent: true },
  // Faridah Àbíké-Íyímídé (id 317)
  { source: '/authors/faridah-b-k-y-m-d', destination: '/authors/faridah-abike-iyimide', permanent: true },
  // Pénélope Bagieu (id 780)
  { source: '/authors/p-n-lope-bagieu', destination: '/authors/penelope-bagieu', permanent: true },
  // Renée Ahdieh (id 874)
  { source: '/authors/ren-e-ahdieh', destination: '/authors/renee-ahdieh', permanent: true },
  // Junot Díaz (id 928)
  { source: '/authors/junot-d-az', destination: '/authors/junot-diaz', permanent: true },
  // Alfred Döblin (id 1009)
  { source: '/authors/alfred-d-blin', destination: '/authors/alfred-doblin', permanent: true },
  // Antoine de Saint-Exupéry (id 1026)
  { source: '/authors/antoine-de-saint-exup-ry', destination: '/authors/antoine-de-saint-exupery', permanent: true },
  // Elizabeth LaPensée (id 1197)
  { source: '/authors/elizabeth-lapens-e', destination: '/authors/elizabeth-lapensee', permanent: true },
  // Moïra Fowley-Doyle (id 1291)
  { source: '/authors/mo-ra-fowley-doyle', destination: '/authors/moira-fowley-doyle', permanent: true },
  // Matt de la Peña (id 1589)
  { source: '/authors/matt-de-la-pe-a', destination: '/authors/matt-de-la-pena', permanent: true },
  // Kōhei Horikoshi (id 1634)
  { source: '/authors/k-hei-horikoshi', destination: '/authors/kohei-horikoshi', permanent: true },
  // Lesléa Newman (id 2106)
  { source: '/authors/lesl-a-newman', destination: '/authors/leslea-newman', permanent: true },
  // Máel Embser-Herbert (id 2184)
  { source: '/authors/m-el-embser-herbert', destination: '/authors/mael-embser-herbert', permanent: true },
  // Alyson Noël (id 2560)
  { source: '/authors/alyson-no-l', destination: '/authors/alyson-noel', permanent: true },
  // Bastien Vivès (id 2838)
  { source: '/authors/bastien-viv-s', destination: '/authors/bastien-vives', permanent: true },
  // Jean-Noël Fabiani (id 2864)
  { source: '/authors/jean-no-l-fabiani', destination: '/authors/jean-noel-fabiani', permanent: true },
  // Gō Ikeyamada (id 2923)
  { source: '/authors/g-ikeyamada', destination: '/authors/go-ikeyamada', permanent: true },
  // Patrick Süskind (id 3271)
  { source: '/authors/patrick-s-skind', destination: '/authors/patrick-suskind', permanent: true },
  // Marie des Neiges Léonard (id 3325)
  { source: '/authors/marie-des-neiges-l-onard', destination: '/authors/marie-des-neiges-leonard', permanent: true },
  // Zoraida Córdova (id 3542)
  { source: '/authors/zoraida-c-rdova', destination: '/authors/zoraida-cordova', permanent: true },
  // Cristina García (id 3579)
  { source: '/authors/cristina-garc-a', destination: '/authors/cristina-garcia', permanent: true },
  // Seán Michael Wilson (id 3627)
  { source: '/authors/sea-n-michael-wilson', destination: '/authors/sean-michael-wilson', permanent: true },
  // Miyoshi Tōmori (id 3649)
  { source: '/authors/miyoshi-to-mori', destination: '/authors/miyoshi-tomori', permanent: true },
  // Yūki Tabata (id 3722)
  { source: '/authors/yu-ki-tabata', destination: '/authors/yuki-tabata', permanent: true },
  // Enric Jardí (id 3759)
  { source: '/authors/enric-jard', destination: '/authors/enric-jardi', permanent: true },
  // Yūma Andō (id 4047)
  { source: '/authors/yu-ma-ando', destination: '/authors/yuma-ando', permanent: true },
]
