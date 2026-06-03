# Google Books degenerate cover audit

Detection: a real book cover is portrait. Google returns a degenerate horizontal strip
(top sliver of the cover, watermarked) for some books at zoom=3. Re-fetching at zoom=1
usually returns the full cover.

- Total google-content zoom=3 covers scanned: **3080**
- Flagged ratio<1.2: **392**
  - **Broken strips** (z3 ratio < 0.7): **286**
    - Fixable via zoom=1 (z1 portrait): **252**  ← safe bulk fix
    - Not fixable (z1 also non-portrait): **34**  ← null cover or OpenLibrary lookup
  - **Ambiguous** (z3 ratio 0.7-1.2): **106**  ← likely real square covers, LEAVE ALONE

## Safe bulk fix: 252 strips → zoom=1

| slug | title | z3 | z1 |
|---|---|---|---|
| 19th-century-art | 19th Century Art | 575×92 (0.16) | 128×169 (1.32) |
| 2024-a-graphic-novel | 2024: A Graphic Novel | 575×92 (0.16) | 128×192 (1.5) |
| 50-contemporary-artists-you-should-know | 50 Contemporary Artists You Should Know | 575×92 (0.16) | 128×160 (1.25) |
| 500-ap-psychology-questions-to-know-by-test-day | 500 AP Psychology Questions to Know By Test Day | 575×92 (0.16) | 128×194 (1.52) |
| handbook-support-prisoners-of-conscience | A Handbook of How to Support Prisoners of Conscience | 575×92 (0.16) | 128×197 (1.54) |
| a-soaring-spirit-timeframe-600-400-bc | A Soaring Spirit: Timeframe 600-400 BC | 575×92 (0.16) | 128×158 (1.23) |
| a-tale-for-2000 | A Tale for 2000 | 575×92 (0.16) | 128×183 (1.43) |
| a-warp-in-time | A Warp in Time | 575×92 (0.16) | 128×198 (1.55) |
| a-yellow-raft-in-blue-water | A Yellow Raft in Blue Water | 575×92 (0.16) | 128×209 (1.63) |
| abnormal-psychology | Abnormal Psychology | 575×92 (0.16) | 128×194 (1.52) |
| abortion-internationally | Abortion Internationally | 575×92 (0.16) | 128×191 (1.49) |
| abortion-violence-extremism | Abortion: Violence & Extremism | 575×92 (0.16) | 128×199 (1.55) |
| afghanistan-the-revolution | Afghanistan - The Revolution | 575×92 (0.16) | 128×190 (1.48) |
| age-of-god-kings-timeframe-3000-1500-bc | Age of God-Kings: Timeframe 3000-1500 BC | 575×92 (0.16) | 128×157 (1.23) |
| alice-the-fairy | Alice the Fairy | 575×92 (0.16) | 128×168 (1.31) |
| among-the-imposters | Among the Imposters | 575×92 (0.16) | 128×190 (1.48) |
| angels | Angels | 575×92 (0.16) | 128×164 (1.28) |
| anicent-incas | Anicent Incas | 575×92 (0.16) | 128×189 (1.48) |
| annotated-art | Annotated Art | 575×92 (0.16) | 128×170 (1.33) |
| another-country | Another Country | 575×92 (0.16) | 128×197 (1.54) |
| at-the-end-of-the-night | At the End of the Night | 575×92 (0.16) | 128×195 (1.52) |
| at-work-twenty-five-contemporary-chinese-artists | At Work: Twenty-five Contemporary Chinese Artists | 575×92 (0.16) | 128×154 (1.2) |
| ate-amanha-camaradas | Até amanhã, camaradas | 575×92 (0.16) | 128×179 (1.4) |
| auguste-rodin-1840-1917 | Auguste Rodin: 1840-1917 | 575×92 (0.16) | 128×177 (1.38) |
| bad-boy | Bad Boy | 575×92 (0.16) | 128×199 (1.55) |
| bad-samaritans | Bad Samaritans: The Myth of Free Trade and the Secret History of Capitalism | 575×92 (0.16) | 128×191 (1.49) |
| be-amazing-a-history-of-pride | Be Amazing: A History of Pride | 575×372 (0.65) | 128×165 (1.29) |
| behind-the-mask | Behind the Mask | 575×92 (0.16) | 128×205 (1.6) |
| better-than-running-at-night | Better Than Running at Night | 575×92 (0.16) | 128×215 (1.68) |
| bioethics-sex-genetics-human-reproduction | Bioethics: Sex, Genetics & Human Reproduction | 575×92 (0.16) | 128×156 (1.22) |
| black-as-hes-painted | Black As He's Painted | 575×92 (0.16) | 128×205 (1.6) |
| brooms | Brooms | 575×92 (0.16) | 128×192 (1.5) |
| burned-pcc | Burned (PCC) | 575×92 (0.16) | 128×174 (1.36) |
| butts-are-everywhere | Butts Are Everywhere | 575×372 (0.65) | 128×165 (1.29) |
| cantarella-vol-1 | Cantarella, Vol. 1 | 575×92 (0.16) | 128×195 (1.52) |
| case-histories | Case Histories | 575×92 (0.16) | 128×198 (1.55) |
| cesar-chavez-fighting-for-farmworkers | Cesar Chavez: Fighting for Farmworkers | 575×92 (0.16) | 128×169 (1.32) |
| chagall | Chagall | 575×92 (0.16) | 128×173 (1.35) |
| chardin | Chardin | 575×92 (0.16) | 128×211 (1.65) |
| cheeky-angel-vol-1 | Cheeky Angel, Vol. 1 | 575×92 (0.16) | 128×192 (1.5) |
| cheeky-angel-vol-3 | Cheeky Angel, Vol. 3 | 575×92 (0.16) | 128×195 (1.52) |
| chicken-noodle-soup-for-the-teenage-soul-the-real-deal-challenges-stories-about-disses-losses-messes-stresses-more | Chicken Noodle Soup for the Teenage Soul: The Real Deal Challenges, Stories about Disses, Losses, Messes, Stresses & More | 575×92 (0.16) | 128×207 (1.62) |
| choices-making-right-decisions-in-a-complex-world | Choices: Making Right Decisions in a Complex World | 575×92 (0.16) | 128×203 (1.59) |
| claywork-form-and-idea-in-ceramic-design | Claywork: Form and Idea in Ceramic Design | 575×92 (0.16) | 128×156 (1.22) |
| click-vol-7 | Click, Vol. 7 | 575×92 (0.16) | 128×195 (1.52) |
| club-dead | Club Dead | 575×92 (0.16) | 128×200 (1.56) |
| cosmetic-surgery | Cosmetic Surgery | 575×92 (0.16) | 128×219 (1.71) |
| crimes-and-criminals-of-the-holocaust | Crimes and Criminals of the Holocaust | 575×92 (0.16) | 128×192 (1.5) |
| crisis-in-black-and-white | Crisis in Black and White | 575×92 (0.16) | 128×192 (1.5) |
| cryptid-hunters | Cryptid Hunters | 575×92 (0.16) | 128×190 (1.48) |
| cyclops | Cyclops | 575×92 (0.16) | 128×190 (1.48) |
| date-abuse | Date Abuse | 575×92 (0.16) | 128×187 (1.46) |
| degas | Degas | 575×92 (0.16) | 128×174 (1.36) |
| desert-angel | Desert Angel | 575×92 (0.16) | 128×191 (1.49) |
| detained-a-writers-prison-diary | Detained: A Writer's Prison Diary | 575×92 (0.16) | 128×201 (1.57) |
| diego-velazquez-1599-1660-the-face-of-spain | Diego Velazquez 1599-1660: The Face of Spain | 575×92 (0.16) | 128×177 (1.38) |
| diva-obsexion | Diva Obsexion | 575×92 (0.16) | 128×187 (1.46) |
| doctor-assisted-suicide-and-the-euthanasia-movement | Doctor Assisted Suicide and the Euthanasia Movement | 575×92 (0.16) | 128×194 (1.52) |
| door-by-door-how-sarah-mcbride-became-americas-first-openly-transgender-senator | Door By Door: How Sarah McBride became America's First Openly Transgender Senator | 575×367 (0.64) | 128×163 (1.27) |
| dragon-ball-vol-1 | Dragon Ball, Vol. 1 | 575×92 (0.16) | 128×186 (1.45) |
| dragon-ball-vol-2 | Dragon Ball, Vol. 2 | 575×92 (0.16) | 128×194 (1.52) |
| dragon-ball-vol-7 | Dragon Ball, Vol. 7 | 575×92 (0.16) | 128×187 (1.46) |
| dragon-ball-vol-8 | Dragon Ball, Vol. 8 | 575×92 (0.16) | 128×188 (1.47) |
| dreaming-in-cuban | Dreaming in Cuban | 575×92 (0.16) | 128×197 (1.54) |
| drugs-and-your-parents | Drugs and Your Parents | 575×92 (0.16) | 128×183 (1.43) |
| edward-hopper-a-modern-master | Edward Hopper: A Modern Master | 575×92 (0.16) | 128×185 (1.45) |
| em-camara-lenta | Em Câmara Lenta | 575×92 (0.16) | 128×204 (1.59) |
| euthanasia | Euthanasia | 575×92 (0.16) | 128×214 (1.67) |
| explorers-of-the-ancient-world | Explorers of the Ancient World | 575×92 (0.16) | 128×153 (1.2) |
| far-eastern-art | Far Eastern Art | 575×92 (0.16) | 128×176 (1.38) |
| farm-team | Farm Team | 575×92 (0.16) | 128×190 (1.48) |
| filippo-lippi | Filippo Lippi | 575×92 (0.16) | 128×186 (1.45) |
| first-facts-about-the-ancient-egyptians | First Facts about the Ancient Egyptians | 575×92 (0.16) | 128×162 (1.27) |
| first-facts-about-the-ancient-greeks | First Facts about the Ancient Greeks | 575×92 (0.16) | 128×165 (1.29) |
| first-facts-about-the-ancient-romans | First Facts about the Ancient Romans | 575×92 (0.16) | 128×162 (1.27) |
| founders-of-faith | Founders of Faith | 575×92 (0.16) | 128×203 (1.59) |
| gay-lesbian-bisexual-and-transgender-events-1848-2006 | Gay, Lesbian, Bisexual, and Transgender Events, 1848-2006 | 575×92 (0.16) | 128×168 (1.31) |
| ghost-world | Ghost World | 575×92 (0.16) | 128×180 (1.41) |
| giotto-di-bondon-about-1267-1337 | Giotto di Bondon: About 1267-1337 | 575×92 (0.16) | 128×181 (1.41) |
| girls-in-pants-the-third-summer-of-the-sisterhood | Girls In Pants: The Third Summer Of The Sisterhood | 575×92 (0.16) | 128×171 (1.34) |
| glbtq-the-survival-guide-for-queer-and-questioning-teens | GLBTQ*: The Survival Guide for Queer and Questioning Teens | 575×92 (0.16) | 128×193 (1.51) |
| god-a-brief-history | God: A Brief History | 575×92 (0.16) | 128×162 (1.27) |
| gods-and-goddesses | Gods and Goddesses | 575×92 (0.16) | 128×163 (1.27) |
| great-wonders-of-the-world | Great Wonders of the World | 575×92 (0.16) | 128×153 (1.2) |
| greece | Greece | 575×92 (0.16) | 128×175 (1.37) |
| greek-legends-and-stories | Greek Legends and Stories | 575×92 (0.16) | 128×192 (1.5) |
| gustav-klimt-drawings-paintings | Gustav Klimt: Drawings & Paintings | 575×92 (0.16) | 128×182 (1.42) |
| happily-ever-after | Happily Ever After | 575×92 (0.16) | 128×202 (1.58) |
| hate-groups | Hate Groups | 575×92 (0.16) | 128×191 (1.49) |
| high-times-encyclopedia | High Times Encyclopedia of Recreational Drugs | 575×92 (0.16) | 128×244 (1.91) |
| holbein | Holbein | 575×92 (0.16) | 128×178 (1.39) |
| hold-fast | Hold Fast | 575×92 (0.16) | 128×216 (1.69) |
| home-life-in-ancient-egypt | Home Life in Ancient Egypt | 575×92 (0.16) | 128×172 (1.34) |
| home-life-in-ancient-greece | Home Life in Ancient Greece | 575×92 (0.16) | 128×200 (1.56) |
| homosexuality | Homosexuality | 575×92 (0.16) | 128×192 (1.5) |
| how-can-i-be-an-ally | How Can I Be An Ally | 575×92 (0.16) | 128×194 (1.52) |
| how-to-make-a-mummy-talk | How to Make A Mummy Talk | 575×92 (0.16) | 128×190 (1.48) |
| how-to-read-a-painting-lessons-from-the-old-masters | How to Read a Painting: Lessons from the Old Masters | 575×92 (0.16) | 128×181 (1.41) |
| i-never-promised-you-a-rose-garden | I Never Promised You a Rose Garden | 575×92 (0.16) | 128×206 (1.61) |
| ill-get-there-it-better-be-worth-the-trip | I'll Get There. It Better Be Worth the Trip | 575×92 (0.16) | 128×195 (1.52) |
| identity-and-gender | Identity and Gender | 575×92 (0.16) | 128×193 (1.51) |
| if-there-be-thorns | If There Be Thorns | 575×92 (0.16) | 128×218 (1.7) |
| impossible | Impossible | 575×92 (0.16) | 128×192 (1.5) |
| in-the-belly-of-the-beast-letters-from-prison | In the Belly of the Beast: Letters From Prison | 575×92 (0.16) | 128×198 (1.55) |
| insect | Insect | 575×92 (0.16) | 128×168 (1.31) |
| inuyasha-vol-1 | InuYasha Vol. 1 | 575×92 (0.16) | 128×192 (1.5) |
| islam-revealed | Islam Revealed: A Christian Arab's View of Islam | 575×92 (0.16) | 128×199 (1.55) |
| jesus-and-christianity | Jesus and Christianity | 575×92 (0.16) | 128×167 (1.3) |
| john-hedgecoes-new-book-of-photography | John Hedgecoe's New Book of Photography | 575×92 (0.16) | 128×160 (1.25) |
| judaism | Judaism | 575×92 (0.16) | 128×197 (1.54) |
| jump-rope-readers-tangerine-series | Jump Rope Readers Tangerine Series | 575×92 (0.16) | 128×167 (1.3) |
| king-arthur | King Arthur | 575×92 (0.16) | 128×158 (1.23) |
| krishna-and-hindusm | Krishna and Hindusm | 575×92 (0.16) | 128×167 (1.3) |
| kurdistan-an-interstate-colony | Kurdistan: An Interstate Colony | 575×92 (0.16) | 128×190 (1.48) |
| la-vie-parisienne | La Vie Parisienne | 575×92 (0.16) | 128×172 (1.34) |
| leonardo-da-vinci-artist-inventor-and-scientist-of-the-renaissance | Leonardo da Vinci: Artist, Inventor and Scientist of the Renaissance | 575×92 (0.16) | 128×168 (1.31) |
| living-with-religion-and-faith | Living with Religion and Faith | 575×92 (0.16) | 128×206 (1.61) |
| magritte | Magritte | 575×92 (0.16) | 128×173 (1.35) |
| making-up-megaboy | Making Up Megaboy | 575×92 (0.16) | 128×167 (1.3) |
| masaccio-and-the-brancacci-chapel | Masaccio and the Brancacci Chapel | 575×92 (0.16) | 128×171 (1.34) |
| matisse | Matisse | 575×92 (0.16) | 128×198 (1.55) |
| memoir-shamsiah-fakeh | Memoir Shamsiah Fakeh: Dari AWAS ke Rejimen ke-10 | 575×92 (0.16) | 128×200 (1.56) |
| mengenal-allah-melalui-agama-agama-purba | Mengenal Allah Melalui Agama-Agama Purba: Gautama Buddha Seorang Nabi? | 575×92 (0.16) | 128×155 (1.21) |
| mi-bacinica-y-yo-para-ella | Mi bacinica y yo: para ella | 575×92 (0.16) | 128×173 (1.35) |
| michelangelo-merisi-da-caravaggio-1571-1610 | Michelangelo Merisi da Caravaggio, 1571-1610 | 575×92 (0.16) | 128×199 (1.55) |
| moses-and-judaism | Moses and Judaism | 575×92 (0.16) | 128×166 (1.3) |
| my-rainbow | My Rainbow | 575×365 (0.63) | 128×161 (1.26) |
| mythology-eyewitness | Mythology (Eyewitness) | 575×92 (0.16) | 128×170 (1.33) |
| national-gallery-of-art-master-paintings-from-the-collection | National Gallery of Art: Master Paintings from the Collection | 575×92 (0.16) | 128×177 (1.38) |
| next | Next | 575×92 (0.16) | 128×215 (1.68) |
| nights-in-rodanthe | Nights in Rodanthe | 575×92 (0.16) | 128×194 (1.52) |
| o-delfim | O Delfim | 575×92 (0.16) | 128×204 (1.59) |
| pablo-picasso-a-retrospective | Pablo Picasso, A Retrospective | 575×92 (0.16) | 128×153 (1.2) |
| paul-cezanne | Paul Cézanne | 575×92 (0.16) | 128×168 (1.31) |
| persecution-and-emigration | Persecution and Emigration | 575×92 (0.16) | 128×201 (1.57) |
| persepolis-2-the-story-of-a-return | Persepolis 2: The Story of a Return | 575×92 (0.16) | 128×189 (1.48) |
| petals-on-the-wind | Petals on the Wind | 575×92 (0.16) | 128×211 (1.65) |
| photocraft | Photocraft | 575×92 (0.16) | 128×175 (1.37) |
| pink-blue-and-you-questions-for-kids-about-gender-stereotypes | Pink, Blue, and You! Questions for Kids about Gender Stereotypes | 575×359 (0.62) | 128×159 (1.24) |
| politics-for-the-common-people | Politics for the Common People | 575×92 (0.16) | 128×173 (1.35) |
| portrait-of-a-killer-jack-the-ripper-case-closed | Portrait of a Killer: Jack the Ripper, Case Closed | 575×92 (0.16) | 128×198 (1.55) |
| practical-photography | Practical Photography | 575×92 (0.16) | 128×193 (1.51) |
| quando-os-lobos-uivam | Quando os Lobos Uivam | 575×92 (0.16) | 128×221 (1.73) |
| rainbow-boys | Rainbow Boys | 575×92 (0.16) | 128×189 (1.48) |
| ramses-ii-and-egypt | Ramses II and Egypt | 575×92 (0.16) | 128×168 (1.31) |
| ranma-1-2-vol-21 | Ranma 1/2, Vol. 21 | 575×92 (0.16) | 128×191 (1.49) |
| rats-saw-god | Rats Saw God | 575×92 (0.16) | 128×220 (1.72) |
| realism | Realism | 575×92 (0.16) | 128×189 (1.48) |
| red-kayak | Red Kayak | 575×92 (0.16) | 128×198 (1.55) |
| religion | Religion | 575×92 (0.16) | 128×168 (1.31) |
| renaissance | Renaissance | 575×92 (0.16) | 128×198 (1.55) |
| restless-spirit-the-life-and-work-of-dorothea-lange | Restless Spirit: The Life and Work of Dorothea Lange | 575×92 (0.16) | 128×153 (1.2) |
| reunion | Reunion | 575×92 (0.16) | 128×195 (1.52) |
| revolting-rhymes | Revolting Rhymes | 575×92 (0.16) | 128×199 (1.55) |
| revolution | Revolution | 575×92 (0.16) | 128×162 (1.27) |
| sarah-bishop | Sarah Bishop | 575×92 (0.16) | 128×228 (1.78) |
| school-violence | School Violence | 575×92 (0.16) | 128×159 (1.24) |
| seeing-red | Seeing Red | 575×92 (0.16) | 128×186 (1.45) |
| ship-it | Ship It | 575×92 (0.16) | 128×197 (1.54) |
| sister-wendys-story-of-painting-the-essential-guide-to-the-history-of-western-art | Sister Wendy's Story of Painting: The Essential Guide to the History of Western Art | 575×92 (0.16) | 128×163 (1.27) |
| sisters-hermanas | Sisters/Hermanas | 575×92 (0.16) | 128×202 (1.58) |
| snatches-and-lays | Snatches and Lays | 575×92 (0.16) | 128×210 (1.64) |
| social-change-in-the-twenty-first-century | Social Change in the Twenty-First Century | 575×92 (0.16) | 128×191 (1.49) |
| somebody-told-me | Somebody Told Me | 575×92 (0.16) | 128×209 (1.63) |
| special-delivery | Special Delivery | 575×92 (0.16) | 128×190 (1.48) |
| stars-in-their-eyes | Stars in their Eyes | 575×92 (0.16) | 128×202 (1.58) |
| staying-fat-for-sarah-byrnes | Staying Fat for Sarah Byrnes | 575×92 (0.16) | 128×212 (1.66) |
| stolen | Stolen | 575×92 (0.16) | 128×208 (1.63) |
| sula | Sula | 575×92 (0.16) | 128×197 (1.54) |
| surrealism | Surrealism | 575×92 (0.16) | 128×210 (1.64) |
| tar-baby | Tar Baby | 575×92 (0.16) | 128×192 (1.5) |
| tattoo-history-source-book-an-anthology-of-historical-records-of-tattooing-throughout-the-world | Tattoo History Source Book: An Anthology of Historical Records of Tattooing Throughout the World | 575×92 (0.16) | 128×166 (1.3) |
| teenage-sex-and-pregnancy | Teenage Sex and Pregnancy | 575×92 (0.16) | 128×203 (1.59) |
| teens-at-risk | Teens At Risk | 575×92 (0.16) | 128×202 (1.58) |
| telling | Telling | 575×92 (0.16) | 128×200 (1.56) |
| tessa-a-gata | Tessa, a Gata | 575×92 (0.16) | 128×210 (1.64) |
| the-barbarian-tides-timeframe-1500-600-bc | The Barbarian Tides: Timeframe 1500-600 BC | 575×92 (0.16) | 128×164 (1.28) |
| the-bargaining-for-israel | The Bargaining for Israel: In the Shadow of Armageddon | 575×92 (0.16) | 128×206 (1.61) |
| the-battle-for-god | The Battle for God: Fundamentalism in Judaism, Christianity and Islam | 575×92 (0.16) | 128×193 (1.51) |
| the-battle-for-peace | The Battle for Peace | 575×92 (0.16) | 128×203 (1.59) |
| the-black-prophet | The Black Prophet | 575×92 (0.16) | 128×206 (1.61) |
| the-blue-girl | The Blue Girl | 575×92 (0.16) | 128×195 (1.52) |
| the-boy-from-the-basement | The Boy from the Basement | 575×92 (0.16) | 128×212 (1.66) |
| the-color-of-earth | The Color of Earth | 575×92 (0.16) | 128×187 (1.46) |
| the-complete-book-of-cats | The Complete Book of Cats | 575×92 (0.16) | 128×194 (1.52) |
| the-complete-kodak-book-of-photography | The Complete Kodak Book of Photography | 575×92 (0.16) | 128×178 (1.39) |
| the-contemporary-art-book-the-essential-guide-to-200-of-the-worlds-most-widely-exhibited-artists | The Contemporary Art Book: The Essential Guide to 200 of the World's Most Widely Exhibited Artists | 575×92 (0.16) | 128×155 (1.21) |
| the-creek | The Creek | 575×92 (0.16) | 128×194 (1.52) |
| the-crisis-of-islam-holy-war-and-unholy-terror | The Crisis of Islam: Holy War and Unholy Terror | 575×92 (0.16) | 128×192 (1.5) |
| the-crossing | The Crossing | 575×92 (0.16) | 128×206 (1.61) |
| the-curse-of-king-tut | The Curse of King Tut | 575×92 (0.16) | 128×173 (1.35) |
| the-death-penalty-for-teens-a-pro-con-issue | The Death Penalty for Teens: A Pro/Con Issue | 575×275 (0.48) | 128×190 (1.48) |
| the-egypt-game | The Egypt Game | 575×92 (0.16) | 128×208 (1.63) |
| the-encyclopedia-of-sculpting-techniques | The Encyclopedia of Sculpting Techniques | 575×92 (0.16) | 128×175 (1.37) |
| the-epic-of-sheikh-bedreddin | The Epic of Sheikh Bedreddin | 575×92 (0.16) | 128×194 (1.52) |
| the-global-trap | The Global Trap | 575×92 (0.16) | 128×201 (1.57) |
| the-hiding-place-the-triumphant-true-story-of-corrie-ten-boom | The Hiding Place: The Triumphant True Story of Corrie Ten Boom | 575×92 (0.16) | 128×213 (1.66) |
| the-history-of-archaeology-great-excavations-of-the-world | The History of Archaeology: Great Excavations of the World | 575×92 (0.16) | 128×172 (1.34) |
| the-house-of-gold | The House of Gold | 575×92 (0.16) | 128×187 (1.46) |
| the-human-body | The Human Body | 575×92 (0.16) | 128×174 (1.36) |
| the-illustrated-book-of-myths-tales-legends-of-the-world | The Illustrated Book of Myths: Tales & Legends of the World | 575×92 (0.16) | 128×167 (1.3) |
| inside-information-tiananmen-crackdown | The Inside Information of the Bloody Crackdown on Tiananmen on June 4 | 575×92 (0.16) | 128×188 (1.47) |
| the-journey-of-diego-rivera | The Journey of Diego Rivera | 575×92 (0.16) | 128×169 (1.32) |
| the-last-duel-a-true-story-of-crime-scandal-and-trial-by-combat | The Last Duel: A True Story of Crime, Scandal and Trial by Combat | 575×92 (0.16) | 128×195 (1.52) |
| the-little-black-book-for-girlz-a-book-on-healthy-sexuality | The Little Black Book for Girlz: A Book on Healthy Sexuality | 575×92 (0.16) | 128×184 (1.44) |
| the-living | The Living | 575×92 (0.16) | 128×190 (1.48) |
| the-minotaur | The Minotaur | 575×92 (0.16) | 128×165 (1.29) |
| the-new-class | The New Class | 575×92 (0.16) | 128×193 (1.51) |
| the-oklahoma-city-bombing-terror-in-the-heartland | The Oklahoma City Bombing: Terror in the Heartland | 575×92 (0.16) | 128×183 (1.43) |
| the-panorama-of-the-renaissance | The Panorama of the Renaissance | 575×92 (0.16) | 128×162 (1.27) |
| the-parthenon-of-ancient-greece | The Parthenon of Ancient Greece | 575×92 (0.16) | 128×174 (1.36) |
| the-poetry-of-the-negro-1746-1970 | The Poetry of the Negro: 1746-1970 | 575×92 (0.16) | 128×200 (1.56) |
| the-poster-a-visual-history | The Poster: A Visual History | 575×92 (0.16) | 128×161 (1.26) |
| the-queen-of-everything | The Queen of Everything | 575×92 (0.16) | 128×180 (1.41) |
| the-roman-news | The Roman News | 575×92 (0.16) | 128×171 (1.34) |
| the-second-chechen-war | The Second Chechen War | 575×92 (0.16) | 128×188 (1.47) |
| the-seven-wonders-of-the-ancient-world | The Seven Wonders of the Ancient World | 575×92 (0.16) | 128×168 (1.31) |
| the-seven-wonders-of-the-historic-world | The Seven Wonders of the Historic World | 575×92 (0.16) | 128×168 (1.31) |
| the-seventh-acolyte-reader | The Seventh Acolyte Reader | 575×92 (0.16) | 128×197 (1.54) |
| the-skeletal-and-muscular-systems | The Skeletal and Muscular systems | 575×92 (0.16) | 128×176 (1.38) |
| the-sorrow-of-war | The Sorrow of War | 575×92 (0.16) | 128×199 (1.55) |
| the-space-race-of-1869 | The Space Race of 1869 | 575×92 (0.16) | 128×195 (1.52) |
| the-tale-of-a-body-thief | The Tale of a Body Thief | 575×92 (0.16) | 128×189 (1.48) |
| the-watchers-test | The Watcher's Test | 575×92 (0.16) | 128×212 (1.66) |
| the-whats-happening-to-my-body-book-for-girls-a-growing-up-guide-for-parents-and-daughters | The What's Happening to My Body? Book for Girls: A Growing-up Guide for Parents and Daughters | 575×92 (0.16) | 128×198 (1.55) |
| world-of-american-pit-bull-terrier | The World of the American Pit Bull Terrier | 575×92 (0.16) | 128×188 (1.47) |
| the-young-guardia | The Young Guardia | 575×92 (0.16) | 128×208 (1.63) |
| then-he-ate-my-boy-entrancers-more-mad-marvy-convessions-of-georgia-nicolson | Then He Ate My Boy Entrancers: More Mad, Marvy Convessions of Georgia Nicolson | 575×92 (0.16) | 128×191 (1.49) |
| theres-only-one-you | There's Only One You | 575×92 (0.16) | 128×219 (1.71) |
| titian-sacred-and-profane-love | Titian: Sacred and Profane Love | 575×92 (0.16) | 128×165 (1.29) |
| tiziano-vecaellio-known-as-titian | Tiziano Vecaellio, known as Titian | 575×92 (0.16) | 128×154 (1.2) |
| towards-genocide | Towards Genocide | 575×92 (0.16) | 128×210 (1.64) |
| trails-to-the-far-west-beyond-the-mississippi | Trails to the Far West: Beyond the Mississippi | 575×92 (0.16) | 128×190 (1.48) |
| vampires | Vampires | 575×92 (0.16) | 128×164 (1.28) |
| van-gogh | Van Gogh | 575×92 (0.16) | 128×185 (1.45) |
| vanished-civilizations-of-the-ancient-world | Vanished Civilizations of the Ancient World | 575×92 (0.16) | 128×176 (1.38) |
| velazquez | Velázquez | 575×92 (0.16) | 128×169 (1.32) |
| vincent-van-gogh-the-complete-paintings | Vincent van Gogh: The Complete Paintings | 575×92 (0.16) | 128×169 (1.32) |
| violence-in-the-media | Violence in the Media | 575×92 (0.16) | 128×207 (1.62) |
| virgin-ground-upturned | Virgin Ground Upturned | 575×92 (0.16) | 128×196 (1.53) |
| washington-d-c | Washington, D.C | 575×92 (0.16) | 128×203 (1.59) |
| we-the-people-the-trail-of-tears | We the People: The Trail of Tears | 575×92 (0.16) | 128×184 (1.44) |
| what-life-was-like-on-the-banks-of-the-nile-egypt-3050-30-bc | What Life Was Like on the Banks of the Nile: Egypt 3050-30 BC | 575×92 (0.16) | 128×171 (1.34) |
| what-motivates-suicide-bombers | What Motivates Suicide Bombers? | 575×92 (0.16) | 128×195 (1.52) |
| what-on-earth-is-a-pangolin | What on Earth Is a Pangolin? | 575×92 (0.16) | 128×174 (1.36) |
| what-uncle-sam-really-wants | What Uncle Sam Really Wants | 575×92 (0.16) | 128×210 (1.64) |
| when-the-beginning-began-stories-about-god-the-creatures-and-us | When the Beginning Began: Stories about God, the Creatures, and Us | 575×92 (0.16) | 128×192 (1.5) |
| where-the-stars-still-shine | Where the Stars Still Shine | 575×92 (0.16) | 128×192 (1.5) |
| witches | Witches | 575×92 (0.16) | 128×177 (1.38) |
| witches-and-magic-makers | Witches and Magic-Makers | 575×92 (0.16) | 128×168 (1.31) |
| woke-a-young-poets-call-to-justice | Woke: A Young Poets Call to Justice | 575×352 (0.61) | 128×154 (1.2) |
| yayoi-kusama | Yayoi Kusama | 575×92 (0.16) | 128×169 (1.32) |

## Not fixable: 34 strips (z1 also bad)

| slug | title | z3 | z1 |
|---|---|---|---|
| a-pair-of-socks | A Pair of Socks | 575×92 (0.16) | 128×104 (0.81) |
| birthday | Birthday | 575×92 (0.16) | 128×120 (0.94) |
| bodies-are-cool | Bodies Are Cool | 575×288 (0.5) | 128×128 (1) |
| born-ready-the-true-story-of-a-boy-named-penelope | Born Ready: The True Story of a Boy Named Penelope | 575×288 (0.5) | 128×128 (1) |
| calvin | Calvin | 575×338 (0.59) | 128×150 (1.17) |
| everything-grows | Everything Grows | 575×92 (0.16) | 128×105 (0.82) |
| fight-for-freedom-the-american-revolutionary-war | Fight For Freedom: The American Revolutionary War | 575×92 (0.16) | 128×131 (1.02) |
| halloween-abc | Halloween ABC | 575×92 (0.16) | 128×109 (0.85) |
| i-am-an-antiracist-superhero | I Am An AntiRacist Superhero | 575×322 (0.56) | 128×143 (1.12) |
| i-am-billie-jean-king | I am Billie Jean King | 575×288 (0.5) | 128×128 (1) |
| it-feels-good-to-be-yourself-a-book-about-gender-identity | It Feels Good to Be Yourself: A Book About Gender Identity | 575×288 (0.5) | 128×128 (1) |
| louvre-400-masterpieces | Louvre: 400 Masterpieces | 575×92 (0.16) | 128×145 (1.13) |
| love-makes-a-family-friends-family-and-significant-others | Love Makes a Family: Friends, Family, and Significant Others | 575×92 (0.16) | 128×123 (0.96) |
| marleys-pride | Marley's Pride | 575×278 (0.48) | 128×124 (0.97) |
| masterpieces-the-best-loved-paintings-from-americas-museums | Masterpieces: The Best-Loved Paintings from America's Museums | 575×92 (0.16) | 128×130 (1.02) |
| nightingale | Nightingale | 575×92 (0.16) | 128×121 (0.95) |
| no-bows | No Bows! | 575×92 (0.16) | 128×136 (1.06) |
| not-he-or-she-im-me | Not He or She, I'm Me | 575×288 (0.5) | 128×128 (1) |
| our-skin-a-first-conversation-about-race | Our Skin: A First Conversation About Race | 575×319 (0.55) | 128×142 (1.11) |
| richard-jolley-sculptor-of-glass | Richard Jolley: Sculptor of Glass | 575×92 (0.16) | 128×131 (1.02) |
| swimwear-in-vogue-since-1910 | Swimwear in Vogue Since 1910 | 575×92 (0.16) | 128×142 (1.11) |
| teos-tutu | Téo's Tutu | 575×319 (0.55) | 128×142 (1.11) |
| the-architecture-and-design-of-man-and-woman-the-marvel-of-the-human-body-revealed | The Architecture and Design of Man and Woman: The Marvel of the Human Body, Revealed | 575×92 (0.16) | 128×142 (1.11) |
| the-language-of-flowers-symbols-and-myths | The Language of Flowers: Symbols and Myths | 575×92 (0.16) | 128×148 (1.16) |
| the-legend-of-drizzt-vol-2-exile | The Legend of Drizzt, Vol. 2: Exile | 575×92 (0.16) | 128×92 (0.72) |
| the-rainbow-parade | The Rainbow Parade | 575×222 (0.39) | 128×100 (0.78) |
| wake-up-our-souls-a-celebration-of-black-american-artists | Wake Up Our Souls: A Celebration of Black American Artists | 575×92 (0.16) | 128×151 (1.18) |
| were-i-not-a-girl-the-inspiring-and-true-story-of-dr-james-barry | Were I Not a Girl: The Inspiring and True Story of Dr. James Barry | 575×288 (0.5) | 128×133 (1.04) |
| what-life-was-like-at-the-dawn-of-democracy-classical-athens-525-322-bc | What Life Was Like at the Dawn of Democracy: Classical Athens, 525-322 BC | 575×92 (0.16) | 128×131 (1.02) |
| what-life-was-like-at-the-rebirth-of-genius-renaissance-italy-ad-1400-1550 | What Life Was Like at the Rebirth of Genius: Renaissance Italy, AD 1400-1550 | 575×92 (0.16) | 128×128 (1) |
| what-life-was-like-when-rome-ruled-the-world-the-roman-empire-100-bc-ad-200 | What Life Was Like When Rome Ruled the World: The Roman Empire, 100 BC-AD 200 | 575×92 (0.16) | 128×130 (1.02) |
| whats-your-name | What's Your Name? | 575×92 (0.16) | 128×145 (1.13) |
| wolf-island | Wolf Island | 575×92 (0.16) | 128×142 (1.11) |
| yes-no-a-first-conversation-about-consent | Yes! No! A First Conversation about Consent | 575×319 (0.55) | 128×142 (1.11) |

## Ambiguous: 106 likely-real square covers (left untouched)

| slug | title | z3 |
|---|---|---|
| a-childs-introduction-to-pride-the-inspirational-history-and-culture-of-the-lgbtqia-community | A Child's Introduction to Pride: The Inspirational History and Culture of the LGBTQIA+ Community | 575×591 (1.03) |
| a-house-for-everyone-a-story-to-help-children-learn-about-gender-identity-and-gender-expression | A House for Everyone: A Story to Help Children Learn About Gender Identity and Gender Expression | 575×575 (1) |
| a-is-for-activist | A is for Activist | 575×575 (1) |
| a-spoon-on-earth | A Spoon on Earth | 575×656 (1.14) |
| a-tour-of-your-digestive-system | A Tour of Your Digestive System | 575×575 (1) |
| alphonse-mucha | Alphonse Mucha | 575×676 (1.18) |
| antiracist-baby | Antiracist Baby | 575×575 (1) |
| are-you-a-boy-or-are-you-a-girl | Are You A Boy or Are You A Girl? | 575×444 (0.77) |
| art-deco-1910-1939 | Art Deco: 1910-1939 | 575×670 (1.17) |
| art-that-changed-the-world-transformative-art-movements-and-the-paintings-that-inspired-them | Art That Changed the World: Transformative Art Movements and the Paintings That Inspired Them | 575×687 (1.19) |
| being-nikki | Being Nikki | 575×547 (0.95) |
| bronxwood | Bronxwood | 575×439 (0.76) |
| call-and-response-the-story-of-black-lives-matter | Call and Response: The Story of Black Lives Matter | 575×460 (0.8) |
| charcoal-pastels | Charcoal & Pastels | 575×444 (0.77) |
| children-of-violence-in-america | Children of Violence in America | 575×611 (1.06) |
| childrens-book-of-art | Children's Book of Art | 575×687 (1.19) |
| christian-the-hugging-lion | Christian, the Hugging Lion | 575×473 (0.82) |
| christmas-in-mexico | Christmas in México | 575×578 (1.01) |
| dr-xargles-book-of-earthlets | Dr. Xargle's Book of Earthlets | 575×659 (1.15) |
| economy-and-industry-in-ancient-rome | Economy and Industry in Ancient Rome | 575×597 (1.04) |
| el-cocodrilo-que-vino-a-cenar | El cocodrilo que vino a cenar | 575×499 (0.87) |
| emeraldalicious-a-springtime-book-for-kids | Emeraldalicious: A Springtime Book For Kids | 575×575 (1) |
| equality-social-justice-and-our-future | Equality, Social Justice and Our Future | 575×686 (1.19) |
| every-day | Every Day | 575×413 (0.72) |
| families-families-families | Families, Families, Families! | 575×575 (1) |
| fathers-are-part-of-a-family | Fathers are Part of a Family | 575×591 (1.03) |
| fever-crumb | Fever Crumb | 575×490 (0.85) |
| flawless | Flawless | 575×653 (1.14) |
| from-archie-to-zach-a-picture-book | From Archie to Zach: A Picture Book | 575×470 (0.82) |
| from-the-stars-in-the-sky-to-the-fish-in-the-sea | From the Stars in the Sky to the Fish in the Sea | 575×444 (0.77) |
| gay-and-lesbian-history-for-kids-the-century-long-struggle-lgbt-rights-with-21-activities | Gay and Lesbian History for Kids: The Century-Long Struggle LGBT Rights, with 21 Activities | 575×444 (0.77) |
| gender-rebels-30-trans-nonbinary-and-gender-expansive-heroes-past-and-present | Gender Rebels: 30 Trans, Nonbinary, and Gender Expansive Heroes Past and Present | 575×682 (1.19) |
| ghost-houses | Ghost Houses | 575×594 (1.03) |
| gothic-art | Gothic Art | 575×660 (1.15) |
| grandads-pride | Grandad's Pride | 575×671 (1.17) |
| greece-temples-tombs-treasures | Greece: Temples, Tombs & Treasures | 575×688 (1.2) |
| halloween | Halloween | 575×650 (1.13) |
| headin-for-better-times-the-arts-of-the-great-depression | Headin' For Better Times: The Arts of the Great Depression | 575×684 (1.19) |
| human-anatomy-the-definitive-visual-guide | Human Anatomy: The Definitive Visual Guide | 575×687 (1.19) |
| human-body-a-book-with-guts | Human Body: A Book with Guts! | 575×575 (1) |
| if-youll-have-me | If You'll Have Me | 575×413 (0.72) |
| impressionism | Impressionism | 575×673 (1.17) |
| introducing-teddy | Introducing Teddy | 575×575 (1) |
| islam-signs-symbols-and-stories | Islam: Signs, Symbols, and Stories | 575×575 (1) |
| its-christmas-david | It's Christmas, David | 575×496 (0.86) |
| its-not-the-stork-a-book-about-girls-boys-babies-bodies-families-and-friends | It's Not the Stork!: A Book About Girls, Boys, Babies, Bodies, Families and Friends | 575×641 (1.11) |
| j-is-for-justice-an-activism-alphabet | J is for Justice! An Activism Alphabet | 575×575 (1) |
| jack-not-jackie | Jack (Not Jackie) | 575×575 (1) |
| julian-at-the-wedding | Julián at the Wedding | 575×529 (0.92) |
| kiss-number-8 | Kiss Number 8 | 575×408 (0.71) |
| land-and-resources-of-ancient-rome | Land and Resources of Ancient Rome | 575×570 (0.99) |
| laura-dean-keeps-breaking-up-with-me | Laura Dean Keeps Breaking Up with Me | 575×408 (0.71) |
| lets-talk-about-it-the-teens-guide-to-sex-relationships-and-being-a-human-a-grap | Let's Talk About It: The Teen's Guide to Sex, Relationships, and Being a Human (A Graphic Novel) | 575×412 (0.72) |
| lgbtq-human-rights-movement | LGBTQ Human Rights Movement | 575×686 (1.19) |
| lgbtq-history-book | LGBTQ+ History Book | 575×683 (1.19) |
| light-it-up | Light It Up | 575×575 (1) |
| little-rock-girl-how-a-photograph-changed-the-gight-for-integration | Little Rock Girl: How A Photograph Changed the Gight for Integration | 575×646 (1.12) |
| love-is-love-an-important-lgbtq-pride-book-for-kids-about-gay-parents-and-diverse-families | Love Is Love: An Important LGBTQ Pride Book for Kids About Gay Parents and Diverse Families | 575×575 (1) |
| modern-herstory-stories-of-women-and-nonbinary-people-rewriting-history | Modern HERstory: Stories of Women and Nonbinary People Rewriting History | 575×576 (1) |
| modern-women-women-artists-at-the-museum-of-modern-art | Modern Women: Women Artists at the Museum of Modern Art | 575×668 (1.16) |
| mooncakes | Mooncakes | 575×662 (1.15) |
| more-than-a-game-race-gender-and-politics-in-sports | More Than a Game: Race, Gender, and Politics in Sports | 575×575 (1) |
| mothers-are-part-of-a-family | Mothers Are Part of A Family | 575×591 (1.03) |
| my-body-belongs-to-me-mi-cuerpo-me-pertenece | My Body Belongs to Me = Mi Cuerpo me Pertenece | 575×575 (1) |
| my-family-your-family | My Family, Your Family | 575×575 (1) |
| my-own-way-celebrating-gender-freedom-for-kids | My Own Way: Celebrating Gender Freedom for Kids | 575×642 (1.12) |
| my-princess-boy | My Princess Boy | 575×575 (1) |
| peanut-goes-for-the-gold | Peanut Goes for the Gold | 575×575 (1) |
| phoenix-gets-greater | Phoenix Gets Greater | 575×575 (1) |
| phoenix-goes-to-school-a-story-to-support-transgender-and-gender-diverse-children | Phoenix Goes to School: A Story to Support Transgender and Gender Diverse Children | 575×575 (1) |
| poseidon | Poseidon | 575×593 (1.03) |
| pride-celebrating-diversity-and-community | Pride: Celebrating Diversity and Community | 575×677 (1.18) |
| queer-heroes-meet-53-lgbtq-heroes-from-past-and-present | Queer Heroes: Meet 53 LGBTQ Heroes from Past and Present | 575×655 (1.14) |
| queerstory-an-infographic-history-of-the-fight-for-lgbtq-rights | Queerstory: An Infographic History of the Fight for LGBTQ+ Rights | 575×666 (1.16) |
| queso-regional-recipes-for-the-worlds-favorite-chile-cheese-dip | Queso: Regional Recipes for the World's Favorite Chile-Cheese Dip | 575×658 (1.14) |
| rainbow-village-a-story-to-help-children-celebrate-diversity | Rainbow Village: A Story to Help Children Celebrate Diversity | 575×492 (0.86) |
| renaissance-art | Renaissance Art | 575×686 (1.19) |
| romanticism | Romanticism | 575×658 (1.14) |
| sharices-big-voice-a-native-kid-becomes-a-congresswoman | Sharice's Big Voice: A Native Kid Becomes a Congresswoman | 575×471 (0.82) |
| shes-my-dad-a-story-for-children-who-have-a-transgender-parent-or-relative | She's My Dad!: A Story for Children Who Have a Transgender Parent or Relative | 575×575 (1) |
| super-late-bloomer-my-early-days-in-transition | Super Late Bloomer: My Early Days In Transition | 575×467 (0.81) |
| tell-them-we-remember-the-story-of-the-holocaust | Tell Them We Remember: The Story of the Holocaust | 575×473 (0.82) |
| the-baroque-period | The Baroque Period | 575×648 (1.13) |
| the-beautiful-stories-of-life-six-greeks-myths-retold | The Beautiful Stories of Life: Six Greeks Myths, Retold | 575×569 (0.99) |
| the-carrie-diaries | The Carrie Diaries | 575×523 (0.91) |
| the-cyclopes | The Cyclopes | 575×480 (0.83) |
| the-good-fight-how-world-war-ii-was-won | The Good Fight: How World War II Was Won | 575×565 (0.98) |
| the-hips-on-the-drag-queen-go-swish-swish-swish | The Hips on the Drag Queen Go Swish, Swish, Swish | 575×570 (0.99) |
| the-legend-of-drizzt-vol-7-the-legacy | The legend of Drizzt, Vol. 7: The Legacy | 575×683 (1.19) |
| the-secret-box | The Secret Box | 575×575 (1) |
| the-snow-globe-family | The Snow Globe Family | 575×481 (0.84) |
| the-sociology-book-big-ideas-simply-explained | The Sociology Book: Big Ideas Simply Explained | 575×687 (1.19) |
| theres-going-to-be-a-baby | There's Going To Be A Baby | 575×589 (1.02) |
| theseus-and-the-minotaur | Theseus and the Minotaur | 575×584 (1.02) |
| top-10-worst-things-about-ancient-greece-you-wouldnt-want-to-know | Top 10 Worst Things about Ancient Greece You Wouldn't Want to Know! | 575×575 (1) |
| twas-the-night-before-pride | Twas the Night Before Pride | 575×634 (1.1) |
| wayward-witch | Wayward Witch | 575×575 (1) |
| we-are-big-time | We Are Big Time | 575×418 (0.73) |
| whaam-the-art-and-life-of-roy-lichtenstein | Whaam!: The Art and Life of Roy Lichtenstein | 575×575 (1) |
| what-riley-wore | What Riley Wore | 575×575 (1) |
| whats-gender-identity | What's Gender Identity? | 575×575 (1) |
| who-are-you-the-kids-guide-to-gender-identity | Who Are You? The Kid's Guide to Gender Identity | 575×574 (1) |
| william-eggleston-portraits | William Eggleston: Portraits | 575×585 (1.02) |
| willow | Willow | 575×685 (1.19) |
| your-own-safety | Your Own Safety | 575×662 (1.15) |
| zoom-in-on-equality | Zoom in on Equality | 575×482 (0.84) |