"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var supabase_1 = require("../src/lib/supabase");
var supabase = (0, supabase_1.adminClient)();
function fetchCover(title, author) {
    return __awaiter(this, void 0, void 0, function () {
        var q, res, json, doc, _a;
        var _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 3, , 4]);
                    q = encodeURIComponent("".concat(title, " ").concat(author));
                    return [4 /*yield*/, fetch("https://openlibrary.org/search.json?q=".concat(q, "&fields=key,cover_i&limit=1"))];
                case 1:
                    res = _e.sent();
                    return [4 /*yield*/, res.json()];
                case 2:
                    json = _e.sent();
                    doc = (_b = json.docs) === null || _b === void 0 ? void 0 : _b[0];
                    return [2 /*return*/, {
                            coverUrl: (doc === null || doc === void 0 ? void 0 : doc.cover_i) ? "https://covers.openlibrary.org/b/id/".concat(doc.cover_i, "-L.jpg") : null,
                            workId: (_d = (_c = doc === null || doc === void 0 ? void 0 : doc.key) === null || _c === void 0 ? void 0 : _c.replace('/works/', '')) !== null && _d !== void 0 ? _d : null,
                        }];
                case 3:
                    _a = _e.sent();
                    return [2 /*return*/, { coverUrl: null, workId: null }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function enrich() {
    return __awaiter(this, void 0, void 0, function () {
        var scopes, reasons, scopeId, reasonId, schoolScope, govScope, existingBooks, existingAuthors, existingBans, bookBySlug, authorBySlug, banFor, authorRows, authorIds, orwell, _i, authorRows_1, row, existing, _a, data, error, covers, toFetch, _b, toFetch_1, _c, slug, title, author, _d, _e, _f, _g, slug, book, error, existingBanPatches, _h, existingBanPatches_1, _j, bookSlug, oldCc, newCc, yearStarted, rslugs, book, ban, _k, rslugs_1, slug, newBooks, _loop_1, _l, newBooks_1, _m, bookData, authorSlugs, banList, wikiUrl;
        var _o, _p;
        return __generator(this, function (_q) {
            switch (_q.label) {
                case 0: return [4 /*yield*/, supabase.from('scopes').select('id, slug')];
                case 1:
                    scopes = (_q.sent()).data;
                    return [4 /*yield*/, supabase.from('reasons').select('id, slug')];
                case 2:
                    reasons = (_q.sent()).data;
                    scopeId = function (slug) {
                        var s = scopes.find(function (s) { return s.slug === slug; });
                        if (!s)
                            throw new Error("Scope not found: ".concat(slug, ". Available: ").concat(scopes.map(function (s) { return s.slug; }).join(', ')));
                        return s.id;
                    };
                    reasonId = function (slug) {
                        var r = reasons.find(function (r) { return r.slug === slug; });
                        if (!r)
                            throw new Error("Reason not found: ".concat(slug, ". Available: ").concat(reasons.map(function (r) { return r.slug; }).join(', ')));
                        return r.id;
                    };
                    schoolScope = scopeId('school');
                    govScope = scopeId('government');
                    return [4 /*yield*/, supabase.from('books').select('id, slug')];
                case 3:
                    existingBooks = (_q.sent()).data;
                    return [4 /*yield*/, supabase.from('authors').select('id, slug')];
                case 4:
                    existingAuthors = (_q.sent()).data;
                    return [4 /*yield*/, supabase.from('bans').select('id, book_id, country_code')];
                case 5:
                    existingBans = (_q.sent()).data;
                    bookBySlug = function (slug) { return existingBooks.find(function (b) { return b.slug === slug; }); };
                    authorBySlug = function (slug) { return existingAuthors.find(function (a) { return a.slug === slug; }); };
                    banFor = function (bookId, cc) {
                        return existingBans.find(function (b) { return b.book_id === bookId && b.country_code === cc; });
                    };
                    // ── New countries ────────────────────────────────────────────
                    return [4 /*yield*/, supabase.from('countries').upsert([
                            { code: 'SU', name_en: 'Soviet Union', slug: 'soviet-union' },
                            { code: 'LB', name_en: 'Lebanon', slug: 'lebanon' },
                            { code: 'IE', name_en: 'Ireland', slug: 'ireland' },
                        ], { onConflict: 'code' })];
                case 6:
                    // ── New countries ────────────────────────────────────────────
                    _q.sent();
                    console.log('Countries upserted.');
                    authorRows = [
                        { slug: 'justin-richardson', display_name: 'Justin Richardson' },
                        { slug: 'peter-parnell', display_name: 'Peter Parnell' },
                        { slug: 'margaret-atwood', display_name: 'Margaret Atwood', birth_year: 1939 },
                        { slug: 'dh-lawrence', display_name: 'D.H. Lawrence', birth_year: 1885, death_year: 1930 },
                        { slug: 'dan-brown', display_name: 'Dan Brown', birth_year: 1964 },
                        { slug: 'aldous-huxley', display_name: 'Aldous Huxley', birth_year: 1894, death_year: 1963 },
                        { slug: 'harper-lee', display_name: 'Harper Lee', birth_year: 1926, death_year: 2016 },
                    ];
                    authorIds = {};
                    orwell = authorBySlug('george-orwell');
                    if (!orwell)
                        throw new Error('George Orwell not found in DB');
                    authorIds['george-orwell'] = orwell.id;
                    _i = 0, authorRows_1 = authorRows;
                    _q.label = 7;
                case 7:
                    if (!(_i < authorRows_1.length)) return [3 /*break*/, 10];
                    row = authorRows_1[_i];
                    existing = authorBySlug(row.slug);
                    if (existing) {
                        authorIds[row.slug] = existing.id;
                        return [3 /*break*/, 9];
                    }
                    return [4 /*yield*/, supabase.from('authors').insert(row).select('id').single()];
                case 8:
                    _a = _q.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw error;
                    authorIds[row.slug] = data.id;
                    _q.label = 9;
                case 9:
                    _i++;
                    return [3 /*break*/, 7];
                case 10:
                    console.log('Authors ready.');
                    // ── Open Library covers ──────────────────────────────────────
                    console.log('Fetching Open Library covers...');
                    covers = {};
                    toFetch = [
                        { slug: '1984', title: '1984', author: 'George Orwell' },
                        { slug: 'the-bluest-eye', title: 'The Bluest Eye', author: 'Toni Morrison' },
                        { slug: 'the-satanic-verses', title: 'The Satanic Verses', author: 'Salman Rushdie' },
                        { slug: 'and-tango-makes-three', title: 'And Tango Makes Three', author: 'Justin Richardson' },
                        { slug: 'animal-farm', title: 'Animal Farm', author: 'George Orwell' },
                        { slug: 'the-handmaids-tale', title: 'The Handmaids Tale', author: 'Margaret Atwood' },
                        { slug: 'lady-chatterleys-lover', title: 'Lady Chatterleys Lover', author: 'DH Lawrence' },
                        { slug: 'the-da-vinci-code', title: 'The Da Vinci Code', author: 'Dan Brown' },
                        { slug: 'brave-new-world', title: 'Brave New World', author: 'Aldous Huxley' },
                        { slug: 'to-kill-a-mockingbird', title: 'To Kill a Mockingbird', author: 'Harper Lee' },
                    ];
                    _b = 0, toFetch_1 = toFetch;
                    _q.label = 11;
                case 11:
                    if (!(_b < toFetch_1.length)) return [3 /*break*/, 14];
                    _c = toFetch_1[_b], slug = _c.slug, title = _c.title, author = _c.author;
                    _d = covers;
                    _e = slug;
                    return [4 /*yield*/, fetchCover(title, author)];
                case 12:
                    _d[_e] = _q.sent();
                    console.log("  ".concat(title, ": ").concat((_o = covers[slug].coverUrl) !== null && _o !== void 0 ? _o : 'no cover'));
                    _q.label = 13;
                case 13:
                    _b++;
                    return [3 /*break*/, 11];
                case 14:
                    _f = 0, _g = ['1984', 'the-bluest-eye', 'the-satanic-verses'];
                    _q.label = 15;
                case 15:
                    if (!(_f < _g.length)) return [3 /*break*/, 18];
                    slug = _g[_f];
                    book = bookBySlug(slug);
                    if (!book)
                        return [3 /*break*/, 17];
                    return [4 /*yield*/, supabase.from('books').update({
                            cover_url: covers[slug].coverUrl,
                            openlibrary_work_id: covers[slug].workId,
                        }).eq('id', book.id)];
                case 16:
                    error = (_q.sent()).error;
                    if (error)
                        throw error;
                    _q.label = 17;
                case 17:
                    _f++;
                    return [3 /*break*/, 15];
                case 18:
                    console.log('Existing books enriched with covers.');
                    existingBanPatches = [
                        { bookSlug: '1984', oldCc: 'US', yearStarted: 1981, reasons: ['political'] },
                        { bookSlug: 'the-bluest-eye', oldCc: 'GB', newCc: 'US', yearStarted: 2006, reasons: ['sexual', 'racial'] },
                        { bookSlug: 'the-satanic-verses', oldCc: 'IR', yearStarted: 1988, reasons: ['religious'] },
                    ];
                    _h = 0, existingBanPatches_1 = existingBanPatches;
                    _q.label = 19;
                case 19:
                    if (!(_h < existingBanPatches_1.length)) return [3 /*break*/, 25];
                    _j = existingBanPatches_1[_h], bookSlug = _j.bookSlug, oldCc = _j.oldCc, newCc = _j.newCc, yearStarted = _j.yearStarted, rslugs = _j.reasons;
                    book = bookBySlug(bookSlug);
                    if (!book)
                        return [3 /*break*/, 24];
                    ban = banFor(book.id, oldCc);
                    if (!ban) {
                        console.warn("Ban not found: ".concat(bookSlug, "/").concat(oldCc));
                        return [3 /*break*/, 24];
                    }
                    return [4 /*yield*/, supabase.from('bans').update(__assign({ year_started: yearStarted }, (newCc ? { country_code: newCc } : {}))).eq('id', ban.id)];
                case 20:
                    _q.sent();
                    _k = 0, rslugs_1 = rslugs;
                    _q.label = 21;
                case 21:
                    if (!(_k < rslugs_1.length)) return [3 /*break*/, 24];
                    slug = rslugs_1[_k];
                    return [4 /*yield*/, supabase.from('ban_reason_links').insert({ ban_id: ban.id, reason_id: reasonId(slug) })];
                case 22:
                    _q.sent();
                    _q.label = 23;
                case 23:
                    _k++;
                    return [3 /*break*/, 21];
                case 24:
                    _h++;
                    return [3 /*break*/, 19];
                case 25:
                    console.log('Existing bans patched.');
                    newBooks = [
                        {
                            book: { title: 'And Tango Makes Three', slug: 'and-tango-makes-three', original_language: 'en', first_published_year: 2005, ai_drafted: false },
                            authorSlugs: ['justin-richardson', 'peter-parnell'],
                            bans: [{ cc: 'US', scope: schoolScope, actionType: 'banned', status: 'active', yearStarted: 2006, reasons: ['lgbtq'] }],
                            wikiUrl: 'https://en.wikipedia.org/wiki/And_Tango_Makes_Three',
                        },
                        {
                            book: { title: 'Animal Farm', slug: 'animal-farm', original_language: 'en', first_published_year: 1945, ai_drafted: false },
                            authorSlugs: ['george-orwell'],
                            bans: [{ cc: 'SU', scope: govScope, actionType: 'banned', status: 'historical', yearStarted: 1945, reasons: ['political'] }],
                            wikiUrl: 'https://en.wikipedia.org/wiki/Animal_Farm',
                        },
                        {
                            book: { title: "The Handmaid's Tale", slug: 'the-handmaids-tale', original_language: 'en', first_published_year: 1985, ai_drafted: false },
                            authorSlugs: ['margaret-atwood'],
                            bans: [{ cc: 'US', scope: schoolScope, actionType: 'banned', status: 'active', yearStarted: 2021, reasons: ['sexual', 'political'] }],
                            wikiUrl: 'https://en.wikipedia.org/wiki/The_Handmaid%27s_Tale',
                        },
                        {
                            book: { title: "Lady Chatterley's Lover", slug: 'lady-chatterleys-lover', original_language: 'en', first_published_year: 1928, ai_drafted: false },
                            authorSlugs: ['dh-lawrence'],
                            bans: [{ cc: 'GB', scope: govScope, actionType: 'banned', status: 'historical', yearStarted: 1928, reasons: ['sexual'] }],
                            wikiUrl: 'https://en.wikipedia.org/wiki/Lady_Chatterley%27s_Lover',
                        },
                        {
                            book: { title: 'The Da Vinci Code', slug: 'the-da-vinci-code', original_language: 'en', first_published_year: 2003, ai_drafted: false },
                            authorSlugs: ['dan-brown'],
                            bans: [{ cc: 'LB', scope: govScope, actionType: 'banned', status: 'active', yearStarted: 2004, reasons: ['religious'] }],
                            wikiUrl: 'https://en.wikipedia.org/wiki/The_Da_Vinci_Code',
                        },
                        {
                            book: { title: 'Brave New World', slug: 'brave-new-world', original_language: 'en', first_published_year: 1932, ai_drafted: false },
                            authorSlugs: ['aldous-huxley'],
                            bans: [{ cc: 'IE', scope: govScope, actionType: 'banned', status: 'historical', yearStarted: 1932, reasons: ['sexual'] }],
                            wikiUrl: 'https://en.wikipedia.org/wiki/Brave_New_World',
                        },
                        {
                            book: { title: 'To Kill a Mockingbird', slug: 'to-kill-a-mockingbird', original_language: 'en', first_published_year: 1960, ai_drafted: false },
                            authorSlugs: ['harper-lee'],
                            bans: [{ cc: 'US', scope: schoolScope, actionType: 'banned', status: 'active', yearStarted: 1977, reasons: ['racial', 'violence'] }],
                            wikiUrl: 'https://en.wikipedia.org/wiki/To_Kill_a_Mockingbird',
                        },
                    ];
                    _loop_1 = function (bookData, authorSlugs, banList, wikiUrl) {
                        var existingBook, cover, bookId, existingBansForBook_1, missingBans, _r, newBook, be, _s, authorSlugs_1, slug, aId, error, _t, banList_1, ban, _u, newBan, bane, _v, _w, rslug, error, _x, src, se, sle;
                        return __generator(this, function (_y) {
                            switch (_y.label) {
                                case 0:
                                    existingBook = bookBySlug(bookData.slug);
                                    cover = (_p = covers[bookData.slug]) !== null && _p !== void 0 ? _p : { coverUrl: null, workId: null };
                                    bookId = void 0;
                                    if (!existingBook) return [3 /*break*/, 2];
                                    // Book exists — check whether each ban is already present
                                    bookId = existingBook.id;
                                    return [4 /*yield*/, supabase
                                            .from('bans')
                                            .select('id, country_code')
                                            .eq('book_id', bookId)];
                                case 1:
                                    existingBansForBook_1 = (_y.sent()).data;
                                    missingBans = banList.filter(function (ban) { return !existingBansForBook_1.some(function (b) { return b.country_code === ban.cc; }); });
                                    if (missingBans.length === 0) {
                                        console.log("Complete, skipping: ".concat(bookData.title));
                                        return [2 /*return*/, "continue"];
                                    }
                                    console.log("Book exists but missing ".concat(missingBans.length, " ban(s): ").concat(bookData.title));
                                    banList.splice.apply(banList, __spreadArray([0, banList.length], missingBans, false));
                                    return [3 /*break*/, 7];
                                case 2: return [4 /*yield*/, supabase.from('books').insert(__assign(__assign({}, bookData), { cover_url: cover.coverUrl, openlibrary_work_id: cover.workId })).select('id').single()];
                                case 3:
                                    _r = _y.sent(), newBook = _r.data, be = _r.error;
                                    if (be)
                                        throw be;
                                    bookId = newBook.id;
                                    _s = 0, authorSlugs_1 = authorSlugs;
                                    _y.label = 4;
                                case 4:
                                    if (!(_s < authorSlugs_1.length)) return [3 /*break*/, 7];
                                    slug = authorSlugs_1[_s];
                                    aId = authorIds[slug];
                                    if (!aId)
                                        throw new Error("Author ID missing: ".concat(slug));
                                    return [4 /*yield*/, supabase.from('book_authors').insert({ book_id: bookId, author_id: aId })];
                                case 5:
                                    error = (_y.sent()).error;
                                    if (error)
                                        throw error;
                                    _y.label = 6;
                                case 6:
                                    _s++;
                                    return [3 /*break*/, 4];
                                case 7:
                                    _t = 0, banList_1 = banList;
                                    _y.label = 8;
                                case 8:
                                    if (!(_t < banList_1.length)) return [3 /*break*/, 17];
                                    ban = banList_1[_t];
                                    return [4 /*yield*/, supabase.from('bans').insert({
                                            book_id: bookId,
                                            country_code: ban.cc,
                                            scope_id: ban.scope,
                                            action_type: ban.actionType,
                                            status: ban.status,
                                            year_started: ban.yearStarted,
                                        }).select('id').single()];
                                case 9:
                                    _u = _y.sent(), newBan = _u.data, bane = _u.error;
                                    if (bane)
                                        throw bane;
                                    _v = 0, _w = ban.reasons;
                                    _y.label = 10;
                                case 10:
                                    if (!(_v < _w.length)) return [3 /*break*/, 13];
                                    rslug = _w[_v];
                                    return [4 /*yield*/, supabase.from('ban_reason_links').insert({
                                            ban_id: newBan.id,
                                            reason_id: reasonId(rslug),
                                        })];
                                case 11:
                                    error = (_y.sent()).error;
                                    if (error)
                                        throw error;
                                    _y.label = 12;
                                case 12:
                                    _v++;
                                    return [3 /*break*/, 10];
                                case 13: return [4 /*yield*/, supabase.from('ban_sources').insert({
                                        source_name: 'Wikipedia',
                                        source_url: wikiUrl,
                                        source_type: 'web',
                                    }).select('id').single()];
                                case 14:
                                    _x = _y.sent(), src = _x.data, se = _x.error;
                                    if (se)
                                        throw se;
                                    return [4 /*yield*/, supabase.from('ban_source_links').insert({
                                            ban_id: newBan.id,
                                            source_id: src.id,
                                        })];
                                case 15:
                                    sle = (_y.sent()).error;
                                    if (sle)
                                        throw sle;
                                    _y.label = 16;
                                case 16:
                                    _t++;
                                    return [3 /*break*/, 8];
                                case 17:
                                    console.log("Inserted: ".concat(bookData.title));
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _l = 0, newBooks_1 = newBooks;
                    _q.label = 26;
                case 26:
                    if (!(_l < newBooks_1.length)) return [3 /*break*/, 29];
                    _m = newBooks_1[_l], bookData = _m.book, authorSlugs = _m.authorSlugs, banList = _m.bans, wikiUrl = _m.wikiUrl;
                    return [5 /*yield**/, _loop_1(bookData, authorSlugs, banList, wikiUrl)];
                case 27:
                    _q.sent();
                    _q.label = 28;
                case 28:
                    _l++;
                    return [3 /*break*/, 26];
                case 29:
                    console.log('\nEnrichment complete.');
                    return [2 /*return*/];
            }
        });
    });
}
enrich().catch(function (err) { console.error(err); process.exit(1); });
