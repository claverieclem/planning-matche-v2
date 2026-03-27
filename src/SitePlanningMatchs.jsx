import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Upload,
  FileSpreadsheet,
  Printer,
  Trash2,
  Download,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const DAY_NAMES = ['SAMEDI', 'DIMANCHE'];
const CATEGORY_ORDER = [
  'BABY',
  'MINI HAND',
  'MOINS DE 7',
  'MOINS DE 9',
  'MOINS DE 11',
  'MOINS DE 13',
  'MOINS DE 15',
  'MOINS DE 17',
  'MOINS DE 18',
  'SENIORS',
  'LOISIRS',
];

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function isTimeLike(value) {
  if (value == null || value === '') return false;
  if (typeof value === 'number') return value >= 0 && value < 1;
  return /^(\d{1,2})[:H](\d{2})$/.test(normalize(value));
}

function excelTimeToHHMM(value) {
  if (typeof value === 'number') {
    const totalMinutes = Math.round(value * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  const text = normalize(value).replace('H', ':');
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return cleanText(value);
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function getGenderRank(label) {
  const text = normalize(label);
  if (/\bM\b|MASC|GARCONS|GARS/.test(text)) return 0;
  if (/\bF\b|FEM|FILLES/.test(text)) return 1;
  return 2;
}

function getCategoryRank(label) {
  const text = normalize(label);
  const index = CATEGORY_ORDER.findIndex((cat) => text.includes(cat));
  return index === -1 ? 999 : index;
}

function compareHome(a, b) {
  if (a.day !== b.day) return DAY_NAMES.indexOf(a.day) - DAY_NAMES.indexOf(b.day);
  return (
    a.time.localeCompare(b.time) ||
    getGenderRank(a.team) - getGenderRank(b.team) ||
    getCategoryRank(a.team) - getCategoryRank(b.team) ||
    a.team.localeCompare(b.team)
  );
}

function compareAway(a, b) {
  if (a.day !== b.day) return DAY_NAMES.indexOf(a.day) - DAY_NAMES.indexOf(b.day);
  return (
    getCategoryRank(a.team) - getCategoryRank(b.team) ||
    getGenderRank(a.team) - getGenderRank(b.team) ||
    a.team.localeCompare(b.team) ||
    a.time.localeCompare(b.time)
  );
}

function parseStructuredRows(rows) {
  if (!rows.length) return [];

  const headerRowIndex = rows.findIndex((row) =>
    row.some((cell) => normalize(cell).includes('JOUR'))
  );

  if (headerRowIndex === -1) return [];

  const headers = rows[headerRowIndex].map((h) => normalize(h));
  const indexOf = (...names) => headers.findIndex((h) => names.some((n) => h.includes(n)));

  const dayIdx = indexOf('JOUR');
  const timeIdx = indexOf('HEURE');
  const teamIdx = indexOf('EQUIPE', 'CATEGORIE');
  const opponentIdx = indexOf('ADVERSAIRE', 'ADVERSE', 'OPPOSANT');
  const venueIdx = indexOf('DOMICILE', 'EXTERIEUR', 'TYPE');
  const locationIdx = headers.findIndex(
    (h, i) => i !== venueIdx && (h.includes('LIEU') || h.includes('SALLE') || h.includes('ADRESSE'))
  );

  if (dayIdx === -1 || timeIdx === -1 || teamIdx === -1 || venueIdx === -1) return [];

  return rows
    .slice(headerRowIndex + 1)
    .filter((row) => row.some((cell) => cleanText(cell) !== ''))
    .map((row) => {
      const venueRaw = normalize(row[venueIdx]);
      const isHome = venueRaw.includes('DOM') || venueRaw.includes('HOME');
      const isAway = venueRaw.includes('EXT') || venueRaw.includes('AWAY');

      return {
        day: normalize(row[dayIdx]),
        time: excelTimeToHHMM(row[timeIdx]),
        team: cleanText(row[teamIdx]),
        opponent: opponentIdx >= 0 ? cleanText(row[opponentIdx]) : '',
        locationType: isHome ? 'domicile' : isAway ? 'exterieur' : '',
        place: locationIdx >= 0 ? cleanText(row[locationIdx]) : '',
      };
    })
    .filter(
      (match) =>
        DAY_NAMES.some((day) => match.day.includes(day)) && match.team && match.time
    );
}

function parseVisualRows(rows) {
  const matches = [];
  let currentDay = '';
  let currentVenue = '';

  for (const row of rows) {
    const rawCells = row.map((cell) => (cell == null ? '' : cell));
    const cells = rawCells.map(cleanText).filter(Boolean);
    const joined = normalize(cells.join(' '));
    if (!joined) continue;

    if (joined.includes('SAMEDI')) currentDay = 'SAMEDI';
    if (joined.includes('DIMANCHE')) currentDay = 'DIMANCHE';
    if (joined.includes('MATCHS A DOMICILE')) currentVenue = 'domicile';
    if (joined.includes('MATCHS A L EXTERIEUR')) currentVenue = 'exterieur';

    if (!currentDay || !currentVenue) continue;

    const timeIndex = rawCells.findIndex((cell) => isTimeLike(cell));
    if (timeIndex === -1) continue;

    const time = excelTimeToHHMM(rawCells[timeIndex]);
    const textCells = rawCells
      .map((cell, index) => ({ index, value: cleanText(cell) }))
      .filter((cell) => cell.value !== '');

    const teamCell = textCells.find(
      (cell) =>
        cell.index > timeIndex &&
        !/^A\s/.test(normalize(cell.value)) &&
        !normalize(cell.value).includes('PNS') &&
        !normalize(cell.value).includes('BUROS/PNS') &&
        !normalize(cell.value).includes('PNS/BUROS')
    );

    const placeCell = textCells.find(
      (cell) => cell.index > timeIndex && (/^A\s|^À\s/.test(normalize(cell.value)) || cell.index >= 7)
    );

    if (teamCell?.value) {
      matches.push({
        day: currentDay,
        time,
        team: teamCell.value,
        opponent: '',
        locationType: currentVenue,
        place: placeCell?.value || '',
      });
    }
  }

  return matches;
}

function deduplicate(matches) {
  const seen = new Set();
  return matches.filter((match) => {
    const key = `${match.day}|${match.time}|${normalize(match.team)}|${normalize(match.opponent || '')}|${match.locationType}|${normalize(match.place)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readWorkbook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const rows = workbook.SheetNames.flatMap((sheetName) =>
          XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
            header: 1,
            raw: true,
            defval: '',
          })
        );

        const structured = parseStructuredRows(rows);
        const matches = structured.length ? structured : parseVisualRows(rows);
        resolve(deduplicate(matches));
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function PreviewMatchRow({ match, home }) {
  return (
    <div
      className={`grid grid-cols-[1.4fr_60px_1.2fr_110px] items-center rounded-full shadow-lg ${
        home ? 'bg-amber-400 text-black' : 'bg-sky-500 text-white'
      }`}
    >
      <div className="truncate px-4 py-3 text-center text-base font-extrabold uppercase">{match.team}</div>
      <div className={`text-center text-xl font-black ${home ? '' : 'text-yellow-200'}`}>VS</div>
      <div className="truncate px-3 py-3 text-center text-base font-extrabold uppercase">
        {match.opponent || match.place || (home ? 'DOMICILE' : 'EXTÉRIEUR')}
      </div>
      <div
        className={`rounded-r-full border-l-4 border-red-800 px-3 py-3 text-center text-lg font-black ${
          home ? 'bg-amber-300 text-black' : 'bg-sky-400 text-white'
        }`}
      >
        {match.time}
      </div>
    </div>
  );
}

function downloadTemplate() {
  const rows = [
    ['Jour', 'Heure', 'Équipe', 'Adversaire', 'Domicile/Extérieur', 'Lieu'],
    ['Samedi', '13:30', 'Moins de 15 M 1', 'Ossau', 'Domicile', ''],
    ['Samedi', '18:00', 'Moins de 18 F 1', 'Nafarroa', 'Domicile', 'Salle du club'],
    ['Dimanche', '16:00', 'Seniors M 1', 'Hendaye', 'Extérieur', 'À Buros'],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 24 }, { wch: 22 }, { wch: 20 }, { wch: 20 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Matchs');

  const arrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'modele_planning_matchs.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function SitePlanningMatchs() {
  const [background, setBackground] = useState(null);
  const [backgroundName, setBackgroundName] = useState('');
  const [introImage, setIntroImage] = useState(null);
  const [introName, setIntroName] = useState('');
  const [matches, setMatches] = useState([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [previewTitle, setPreviewTitle] = useState('PLANNING DU WEEK-END');
  const [previewSubtitle, setPreviewSubtitle] = useState('APERÇU EN DIRECT');
  const [showHome, setShowHome] = useState(true);
  const [showAway, setShowAway] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const parsed = await readWorkbook(file);
      if (!parsed.length) {
        setMatches([]);
        setFileName(file.name);
        setError('Aucun match exploitable trouvé dans ce fichier.');
        return;
      }
      setMatches(parsed);
      setFileName(file.name);
      setCurrentSlide(0);
    } catch {
      setMatches([]);
      setFileName(file.name);
      setError('Le fichier n’a pas pu être lu correctement.');
    }
  }

  function handleBackgroundChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setBackground(reader.result);
      setBackgroundName(file.name);
    };
    reader.readAsDataURL(file);
  }

  function handleIntroChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setIntroImage(reader.result);
      setIntroName(file.name);
      setCurrentSlide(0);
    };
    reader.readAsDataURL(file);
  }

  function resetAll() {
    setMatches([]);
    setFileName('');
    setError('');
    setBackground(null);
    setBackgroundName('');
    setIntroImage(null);
    setIntroName('');
    setPreviewTitle('PLANNING DU WEEK-END');
    setPreviewSubtitle('APERÇU EN DIRECT');
    setShowHome(true);
    setShowAway(true);
    setCurrentSlide(0);
  }

  const homeMatches = useMemo(
    () => matches.filter((match) => match.locationType === 'domicile').sort(compareHome),
    [matches]
  );
  const awayMatches = useMemo(
    () => matches.filter((match) => match.locationType === 'exterieur').sort(compareAway),
    [matches]
  );

  const slides = [];
  if (introImage) slides.push({ type: 'intro' });

  DAY_NAMES.forEach((day) => {
    const homeItems = homeMatches.filter((m) => m.day.includes(day));
    const awayItems = awayMatches.filter((m) => m.day.includes(day));
    if (showHome && homeItems.length) slides.push({ type: 'matches', day, venue: 'Domicile', home: true, items: homeItems });
    if (showAway && awayItems.length) slides.push({ type: 'matches', day, venue: 'Extérieur', home: false, items: awayItems });
  });

  const safeSlideIndex = slides.length ? Math.min(currentSlide, slides.length - 1) : 0;
  const activeSlide = slides[safeSlideIndex] || null;

  function goPrevSlide() {
    setCurrentSlide((value) => Math.max(0, value - 1));
  }

  function goNextSlide() {
    setCurrentSlide((value) => Math.min(slides.length - 1, value + 1));
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-amber-50">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <Badge className="rounded-full bg-red-700 px-3 py-1 text-xs text-white shadow-sm">Planning handball</Badge>
            <h1 className="text-3xl font-black tracking-tight text-red-700 md:text-5xl">Site planning matchs</h1>
            <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
              Importe ton fichier Excel, puis le site trie automatiquement les matchs avec tes règles : domicile par heure, extérieur par catégorie, masculin avant féminin.
            </p>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-red-200 bg-white p-4 text-center shadow-sm">
                <div className="text-xs font-bold text-red-500">RÈGLE 1</div>
                <div className="mt-1 text-lg font-bold text-red-700">Domicile</div>
                <div className="text-xs">Triés par heure</div>
              </div>
              <div className="rounded-2xl border border-blue-200 bg-white p-4 text-center shadow-sm">
                <div className="text-xs font-bold text-blue-500">RÈGLE 2</div>
                <div className="mt-1 text-lg font-bold text-blue-700">Extérieur</div>
                <div className="text-xs">Triés par catégorie</div>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-white p-4 text-center shadow-sm">
                <div className="text-xs font-bold text-amber-500">RÈGLE 3</div>
                <div className="mt-1 text-lg font-bold text-amber-700">Ordre</div>
                <div className="text-xs">Masculin avant féminin</div>
              </div>
            </div>

            <div className="pt-1">
              <div className="mx-auto max-w-3xl">
                {activeSlide?.type === 'intro' ? (
                  <div className="overflow-hidden rounded-[28px] border bg-white shadow-2xl">
                    <img key={introImage} src={introImage} alt="Page intro" className="h-[640px] w-full object-cover" />
                  </div>
                ) : activeSlide?.type === 'matches' ? (
                  <div className="min-h-[640px] overflow-hidden rounded-[28px] border shadow-2xl" style={{ background: background ? `url(${background}) center/cover` : '#7f1d1d' }}>
                    <div className="min-h-[640px] bg-black/15 p-5 md:p-6">
                      <div className="mx-auto max-w-4xl space-y-4">
                        <div className="space-y-1 pt-1 text-center text-white">
                          <h2 className="text-3xl font-black tracking-wide md:text-5xl">{previewTitle || 'PLANNING DU WEEK-END'}</h2>
                          <div className="text-base font-bold uppercase md:text-2xl">{activeSlide.day}</div>
                          <div className="text-sm font-bold uppercase md:text-xl">{activeSlide.venue}</div>
                        </div>
                        {activeSlide.items.map((match, index) => (
                          <PreviewMatchRow key={`${activeSlide.day}-${activeSlide.venue}-${index}`} match={match} home={activeSlide.home} />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="min-h-[640px] overflow-hidden rounded-[28px] border shadow-2xl" style={{ background: background ? `url(${background}) center/cover` : '#7f1d1d' }}>
                    <div className="flex min-h-[640px] items-center justify-center bg-black/15 p-6">
                      <div className="rounded-3xl border border-dashed border-white/40 bg-black/10 p-10 text-center text-white/90">
                        <div className="text-xl font-bold">Aperçu ici</div>
                        <div className="mt-3 text-sm md:text-base">Ajoute une page intro et importe un fichier Excel pour voir le rendu.</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-5 lg:mt-32">
            <Card className="rounded-2xl border border-red-100 bg-white shadow-md backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <FileSpreadsheet className="h-5 w-5" /> Import Excel
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="block">
                  <div className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-red-300 bg-white p-5 text-center transition-colors hover:bg-red-50">
                    <Upload className="h-8 w-8" />
                    <div>
                      <div className="font-semibold">Choisir un fichier .xlsx</div>
                      <div className="text-sm text-muted-foreground">
                        Le plus simple : utiliser le modèle Excel du site avec Jour, Heure, Équipe, Adversaire, Domicile/Extérieur et Lieu.
                      </div>
                    </div>
                  </div>
                  <Input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
                </label>

                {fileName ? <div className="rounded-xl border p-3 text-sm"><span className="font-medium">Fichier chargé :</span> {fileName}</div> : null}
                {backgroundName ? <div className="rounded-xl border p-3 text-sm"><span className="font-medium">Fond chargé :</span> {backgroundName}</div> : null}
                {introName ? <div className="rounded-xl border p-3 text-sm"><span className="font-medium">Page intro :</span> {introName}</div> : null}

                <div className="flex flex-wrap gap-3">
                  <input id="intro-upload" type="file" accept="image/*" className="hidden" onChange={handleIntroChange} />
                  <label htmlFor="intro-upload"><Button variant="outline" className="rounded-xl" asChild><span>🖼️ Page intro</span></Button></label>

                  <input id="background-upload" type="file" accept="image/*" className="hidden" onChange={handleBackgroundChange} />
                  <label htmlFor="background-upload"><Button variant="outline" className="rounded-xl" asChild><span>🎨 Changer fond</span></Button></label>

                  <Button type="button" variant="outline" onClick={downloadTemplate} className="rounded-xl"><Download className="mr-2 h-4 w-4" /> Télécharger le modèle Excel</Button>
                  <Button onClick={() => window.print()} disabled={!matches.length && !introImage} className="rounded-xl !bg-red-700 !text-white hover:!bg-red-800"><Printer className="mr-2 h-4 w-4" /> Imprimer / PDF</Button>
                  <Button variant="outline" onClick={resetAll} className="rounded-xl border-red-300 text-red-600 hover:bg-red-50"><Trash2 className="mr-2 h-4 w-4" /> Réinitialiser</Button>
                </div>

                {error ? <Alert className="rounded-xl"><AlertDescription>{error}</AlertDescription></Alert> : null}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-red-100 bg-white shadow-md backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl"><Eye className="h-5 w-5" /> Mode aperçu comme Canva</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Titre</div>
                    <Input value={previewTitle} onChange={(event) => setPreviewTitle(event.target.value)} placeholder="PLANNING DU WEEK-END" />
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Sous-titre</div>
                    <Input value={previewSubtitle} onChange={(event) => setPreviewSubtitle(event.target.value)} placeholder="SAMEDI 28 MARS" />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button variant={showHome ? 'default' : 'outline'} className={showHome ? 'rounded-xl !bg-red-700 !text-white hover:!bg-red-800' : 'rounded-xl border-red-300 text-red-600 hover:bg-red-50'} onClick={() => setShowHome((value) => !value)}>{showHome ? 'Domicile affiché' : 'Afficher domicile'}</Button>
                  <Button variant={showAway ? 'default' : 'outline'} className={showAway ? 'rounded-xl !bg-blue-700 !text-white hover:!bg-blue-800' : 'rounded-xl border-blue-300 text-blue-600 hover:bg-blue-50'} onClick={() => setShowAway((value) => !value)}>{showAway ? 'Extérieur affiché' : 'Afficher extérieur'}</Button>
                </div>

                <div className="text-sm text-muted-foreground">Tu peux maintenant regarder les pages une par une, comme un post Instagram.</div>

                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Button type="button" variant="outline" className="rounded-xl border-red-200 bg-white text-red-700 hover:bg-red-50" onClick={goPrevSlide} disabled={safeSlideIndex === 0 || !slides.length}><ChevronLeft className="mr-2 h-4 w-4" /> Précédent</Button>
                  <div>Slide {slides.length ? safeSlideIndex + 1 : 0} / {slides.length}</div>
                  <Button type="button" variant="outline" className="rounded-xl border-red-200 bg-white text-red-700 hover:bg-red-50" onClick={goNextSlide} disabled={!slides.length || safeSlideIndex === slides.length - 1}>Suivant <ChevronRight className="ml-2 h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
