// Dati dimostrativi: reparti, supermercati e catalogo prodotti.
// Tutti i nomi di negozi e prodotti sono di fantasia.

export const CATEGORIES = [
  ['ortofrutta', 'Ortofrutta', '🥦'],
  ['carne', 'Carne', '🥩'],
  ['pesce', 'Pesce', '🐟'],
  ['salumi', 'Salumi e formaggi', '🧀'],
  ['latticini', 'Latticini e uova', '🥛'],
  ['pane', 'Pane e panetteria', '🥖'],
  ['pasta', 'Pasta e legumi', '🍝'],
  ['dispensa', 'Riso, farine e conserve', '🥫'],
  ['colazione', 'Biscotti e colazione', '🍪'],
  ['dolci', 'Dolci e snack', '🍫'],
  ['salutistico', 'Salutistico e bio', '🌱'],
  ['senzaglutine', 'Senza glutine', '🌾'],
  ['surgelati', 'Surgelati', '❄️'],
  ['bevande', 'Bevande e acqua', '💧'],
  ['vini', 'Vini e birre', '🍷'],
  ['casa', 'Igiene casa', '🧽'],
  ['persona', 'Cura persona', '🧴'],
  ['infanzia', 'Infanzia', '🍼'],
  ['animali', 'Animali', '🐾'],
];

export const STORES = [
  {
    name: 'Etè', address: 'Via Cavour, Casavatore (NA)', phone: '081 000 0001',
    lat: 40.8995, lng: 14.2780, hours: 'Lun–Sab 8:00–21:00 · Dom 9:00–13:30',
    min_order: 20, prep_minutes: 30, color: '#1E7B4F', emoji: '🛒', priceFactor: 1,
  },
  {
    name: 'Market Più', address: 'Corso Italia, Casavatore (NA)', phone: '081 000 0002',
    lat: 40.8968, lng: 14.2747, hours: 'Lun–Dom 8:00–22:00',
    min_order: 15, prep_minutes: 25, color: '#E8822A', emoji: '🏪', priceFactor: 0.96,
  },
  {
    name: 'Bottega Bio & Bontà', address: 'Via Roma, Casavatore (NA)', phone: '081 000 0003',
    lat: 40.9012, lng: 14.2815, hours: 'Lun–Sab 9:00–20:00',
    min_order: 25, prep_minutes: 35, color: '#5B8C2A', emoji: '🌿', priceFactor: 1.12, onlyCats: ['ortofrutta', 'salutistico', 'senzaglutine', 'pane', 'latticini', 'pasta', 'colazione', 'bevande'],
  },
];

// [categoria, nome, marca/origine, formato, prezzo, unità, emoji, flag]
// unità: 'pz' oppure 'kg' (step = quantità minima ordinabile)
// flag: b = bio, g = senza glutine
export const PRODUCTS = [
  // Ortofrutta (a peso)
  ['ortofrutta', 'Pomodori San Marzano', 'Campania', 'al kg', 3.2, 'kg', '🍅', '', 0.5],
  ['ortofrutta', 'Pomodorini del Piennolo', 'Vesuvio', 'al kg', 4.9, 'kg', '🍅', '', 0.5],
  ['ortofrutta', 'Mele Annurca', 'Campania IGP', 'al kg', 2.6, 'kg', '🍎', '', 0.5],
  ['ortofrutta', 'Arance da tavola', 'Sicilia', 'al kg', 1.9, 'kg', '🍊', '', 1],
  ['ortofrutta', 'Limoni di Sorrento', 'Costiera', 'al kg', 3.5, 'kg', '🍋', '', 0.5],
  ['ortofrutta', 'Banane', 'Ecuador', 'al kg', 1.79, 'kg', '🍌', '', 0.5],
  ['ortofrutta', 'Patate a pasta gialla', 'Italia', 'al kg', 1.29, 'kg', '🥔', '', 1],
  ['ortofrutta', 'Zucchine', 'Campania', 'al kg', 2.4, 'kg', '🥒', '', 0.5],
  ['ortofrutta', 'Friarielli', 'Campania', 'al kg', 4.5, 'kg', '🥬', '', 0.5],
  ['ortofrutta', 'Insalata iceberg', 'Italia', '1 cespo', 1.1, 'pz', '🥬', ''],
  ['ortofrutta', 'Carote', 'Italia', 'busta 1 kg', 1.35, 'pz', '🥕', ''],
  ['ortofrutta', 'Cipolle dorate', 'Italia', 'rete 1 kg', 1.49, 'pz', '🧅', ''],
  // Carne
  ['carne', 'Petto di pollo a fette', 'Allevamento italiano', 'al kg', 11.9, 'kg', '🍗', '', 0.25],
  ['carne', 'Macinato di bovino', 'Bovino italiano', 'al kg', 12.5, 'kg', '🥩', '', 0.25],
  ['carne', 'Salsiccia di maiale', 'Produzione locale', 'al kg', 9.9, 'kg', '🌭', '', 0.25],
  ['carne', 'Fettine di vitello', 'Bovino italiano', 'al kg', 19.9, 'kg', '🥩', '', 0.25],
  ['carne', 'Cosce di pollo', 'Allevamento italiano', 'al kg', 6.9, 'kg', '🍗', '', 0.5],
  ['carne', 'Hamburger di scottona', 'Bovino italiano', '2 x 100 g', 4.2, 'pz', '🍔', ''],
  // Pesce
  ['pesce', 'Alici fresche', 'Golfo di Napoli', 'al kg', 9.5, 'kg', '🐟', '', 0.25],
  ['pesce', 'Orata', 'Allevamento Mediterraneo', 'al kg', 13.9, 'kg', '🐟', '', 0.5],
  ['pesce', 'Cozze', 'Golfo di Napoli', 'rete 1 kg', 4.5, 'pz', '🦪', ''],
  ['pesce', 'Salmone affumicato', 'Norvegia', '100 g', 4.9, 'pz', '🍣', ''],
  // Salumi e formaggi
  ['salumi', 'Prosciutto crudo stagionato', 'Italia', 'al kg', 24.9, 'kg', '🥓', '', 0.1],
  ['salumi', 'Prosciutto cotto alta qualità', 'Italia', 'al kg', 18.9, 'kg', '🥓', '', 0.1],
  ['salumi', 'Salame napoletano', 'Campania', 'al kg', 21.5, 'kg', '🍖', '', 0.1],
  ['salumi', 'Provolone del Monaco', 'Campania DOP', 'al kg', 22.0, 'kg', '🧀', '', 0.1],
  ['salumi', 'Parmigiano 24 mesi', 'Italia DOP', 'al kg', 26.9, 'kg', '🧀', 'g', 0.1],
  ['salumi', 'Mortadella', 'Bologna IGP', 'al kg', 14.9, 'kg', '🍖', '', 0.1],
  // Latticini e uova
  ['latticini', 'Mozzarella di bufala', 'Campana DOP', '250 g', 4.2, 'pz', '🧀', 'g'],
  ['latticini', 'Fior di latte', 'Agerola', '400 g', 3.9, 'pz', '🧀', 'g'],
  ['latticini', 'Ricotta fresca', 'Campania', '250 g', 2.1, 'pz', '🥣', 'g'],
  ['latticini', 'Latte intero fresco', 'Alta qualità', '1 L', 1.69, 'pz', '🥛', 'g'],
  ['latticini', 'Yogurt bianco intero', 'Italia', '4 x 125 g', 1.99, 'pz', '🥛', 'g'],
  ['latticini', 'Uova fresche da allevamento a terra', 'Italia', '6 pz', 2.29, 'pz', '🥚', 'g'],
  ['latticini', 'Burro', 'Italia', '250 g', 2.89, 'pz', '🧈', 'g'],
  // Pane
  ['pane', 'Pane cafone', 'Forno locale', '1 kg', 3.5, 'pz', '🍞', ''],
  ['pane', 'Panini all\'olio', 'Forno locale', '6 pz', 1.8, 'pz', '🥖', ''],
  ['pane', 'Taralli sugna e pepe', 'Napoli', '500 g', 4.9, 'pz', '🥨', ''],
  ['pane', 'Fette biscottate integrali', 'Italia', '320 g', 1.79, 'pz', '🍞', ''],
  ['pane', 'Pane in cassetta', 'Italia', '400 g', 1.69, 'pz', '🍞', ''],
  // Pasta e legumi
  ['pasta', 'Spaghetti di Gragnano', 'Gragnano IGP', '500 g', 1.49, 'pz', '🍝', ''],
  ['pasta', 'Paccheri di Gragnano', 'Gragnano IGP', '500 g', 1.69, 'pz', '🍝', ''],
  ['pasta', 'Mezzi rigatoni', 'Italia', '500 g', 0.99, 'pz', '🍝', ''],
  ['pasta', 'Pasta mista', 'Gragnano IGP', '500 g', 1.39, 'pz', '🍝', ''],
  ['pasta', 'Fagioli cannellini', 'Italia', '400 g', 0.89, 'pz', '🫘', 'g'],
  ['pasta', 'Lenticchie secche', 'Italia', '500 g', 2.19, 'pz', '🫘', 'g'],
  ['pasta', 'Ceci secchi', 'Italia', '500 g', 1.99, 'pz', '🫘', 'g'],
  // Dispensa
  ['dispensa', 'Passata di pomodoro', 'Italia', '700 g', 1.19, 'pz', '🥫', 'g'],
  ['dispensa', 'Pelati San Marzano', 'Agro Sarnese DOP', '400 g', 1.99, 'pz', '🥫', 'g'],
  ['dispensa', 'Riso Carnaroli', 'Italia', '1 kg', 3.49, 'pz', '🍚', 'g'],
  ['dispensa', 'Farina 00', 'Italia', '1 kg', 0.95, 'pz', '🌾', ''],
  ['dispensa', 'Olio extravergine d\'oliva', 'Italia', '1 L', 8.9, 'pz', '🫒', 'g'],
  ['dispensa', 'Tonno all\'olio d\'oliva', 'Italia', '3 x 80 g', 3.29, 'pz', '🐟', 'g'],
  ['dispensa', 'Caffè macinato miscela napoletana', 'Torrefazione napoletana', '250 g', 3.6, 'pz', '☕', 'g'],
  // Colazione
  ['colazione', 'Frollini al burro', 'Italia', '700 g', 2.49, 'pz', '🍪', ''],
  ['colazione', 'Biscotti integrali', 'Italia', '400 g', 1.99, 'pz', '🍪', ''],
  ['colazione', 'Cornetti vuoti', 'Italia', '6 pz', 2.29, 'pz', '🥐', ''],
  ['colazione', 'Crema spalmabile alla nocciola', 'Italia', '400 g', 3.49, 'pz', '🍫', ''],
  ['colazione', 'Muesli croccante', 'Italia', '375 g', 2.79, 'pz', '🥣', ''],
  ['colazione', 'Marmellata di albicocche', 'Italia', '340 g', 2.39, 'pz', '🍯', 'g'],
  // Dolci e snack
  ['dolci', 'Sfogliatelle frolle', 'Pasticceria locale', '4 pz', 5.5, 'pz', '🥮', ''],
  ['dolci', 'Babà al rum', 'Pasticceria locale', '6 pz', 6.9, 'pz', '🧁', ''],
  ['dolci', 'Patatine classiche', 'Italia', '200 g', 1.89, 'pz', '🥔', 'g'],
  ['dolci', 'Cioccolato fondente 70%', 'Italia', '100 g', 1.79, 'pz', '🍫', 'g'],
  ['dolci', 'Mandorle tostate', 'Italia', '200 g', 3.49, 'pz', '🥜', 'g'],
  // Salutistico
  ['salutistico', 'Gallette di riso integrale', 'Linea Bio', '130 g', 1.59, 'pz', '🍘', 'bg'],
  ['salutistico', 'Bevanda di avena', 'Linea Bio', '1 L', 1.99, 'pz', '🥛', 'b'],
  ['salutistico', 'Quinoa', 'Linea Bio', '400 g', 3.99, 'pz', '🌾', 'bg'],
  ['salutistico', 'Tofu al naturale', 'Linea Bio', '250 g', 2.49, 'pz', '🧈', 'bg'],
  ['salutistico', 'Semi misti', 'Linea Bio', '250 g', 3.29, 'pz', '🌻', 'bg'],
  ['salutistico', 'Yogurt greco 0%', 'Italia', '500 g', 2.69, 'pz', '🥣', 'g'],
  // Senza glutine
  ['senzaglutine', 'Pasta di mais e riso', 'Senza glutine', '400 g', 2.29, 'pz', '🍝', 'g'],
  ['senzaglutine', 'Pane senza glutine', 'Senza glutine', '300 g', 3.49, 'pz', '🍞', 'g'],
  ['senzaglutine', 'Biscotti senza glutine', 'Senza glutine', '250 g', 2.99, 'pz', '🍪', 'g'],
  ['senzaglutine', 'Mix farine per pane', 'Senza glutine', '1 kg', 4.49, 'pz', '🌾', 'g'],
  // Surgelati
  ['surgelati', 'Piselli finissimi', 'Italia', '1 kg', 2.99, 'pz', '🫛', 'g'],
  ['surgelati', 'Spinaci in cubetti', 'Italia', '750 g', 1.99, 'pz', '🥬', 'g'],
  ['surgelati', 'Bastoncini di merluzzo', 'Italia', '15 pz', 3.79, 'pz', '🐟', ''],
  ['surgelati', 'Pizza margherita', 'Italia', '2 pz', 4.29, 'pz', '🍕', ''],
  ['surgelati', 'Gelato fiordilatte', 'Italia', '500 g', 3.99, 'pz', '🍨', ''],
  // Bevande
  ['bevande', 'Acqua naturale', 'Fonte italiana', '6 x 1,5 L', 2.49, 'pz', '💧', 'g'],
  ['bevande', 'Acqua frizzante', 'Fonte italiana', '6 x 1,5 L', 2.59, 'pz', '💧', 'g'],
  ['bevande', 'Succo di arancia rossa', 'Sicilia', '1 L', 1.89, 'pz', '🧃', 'g'],
  ['bevande', 'Bibita al limone', 'Italia', '1,5 L', 1.49, 'pz', '🥤', 'g'],
  ['bevande', 'Tè freddo alla pesca', 'Italia', '1,5 L', 1.39, 'pz', '🧋', 'g'],
  // Vini e birre
  ['vini', 'Aglianico', 'Campania DOC', '75 cl', 7.9, 'pz', '🍷', 'g'],
  ['vini', 'Falanghina', 'Campania DOC', '75 cl', 6.9, 'pz', '🍾', 'g'],
  ['vini', 'Lacryma Christi', 'Vesuvio DOC', '75 cl', 9.5, 'pz', '🍷', 'g'],
  ['vini', 'Birra chiara', 'Italia', '6 x 33 cl', 5.49, 'pz', '🍺', ''],
  ['vini', 'Limoncello', 'Costiera', '50 cl', 9.9, 'pz', '🍋', 'g'],
  // Casa
  ['casa', 'Detersivo piatti al limone', 'Casa', '1 L', 1.69, 'pz', '🧴', ''],
  ['casa', 'Detersivo lavatrice', 'Casa', '30 lavaggi', 6.49, 'pz', '🧺', ''],
  ['casa', 'Carta igienica', 'Casa', '8 rotoli', 3.99, 'pz', '🧻', ''],
  ['casa', 'Rotoloni carta cucina', 'Casa', '2 rotoli', 2.49, 'pz', '🧻', ''],
  ['casa', 'Sgrassatore universale', 'Casa', '750 ml', 2.29, 'pz', '🧽', ''],
  // Persona
  ['persona', 'Shampoo delicato', 'Cura', '250 ml', 2.79, 'pz', '🧴', ''],
  ['persona', 'Bagnoschiuma', 'Cura', '500 ml', 2.49, 'pz', '🛁', ''],
  ['persona', 'Dentifricio', 'Cura', '75 ml', 1.99, 'pz', '🪥', ''],
  ['persona', 'Deodorante spray', 'Cura', '150 ml', 2.99, 'pz', '🧴', ''],
  // Infanzia
  ['infanzia', 'Pannolini taglia 4', 'Baby', '30 pz', 9.9, 'pz', '👶', ''],
  ['infanzia', 'Omogeneizzato di frutta', 'Baby', '2 x 80 g', 1.69, 'pz', '🍼', 'g'],
  ['infanzia', 'Salviette detergenti', 'Baby', '72 pz', 1.99, 'pz', '🧻', ''],
  // Animali
  ['animali', 'Crocchette per cani adulti', 'Pet', '3 kg', 8.9, 'pz', '🐕', ''],
  ['animali', 'Umido per gatti', 'Pet', '4 x 85 g', 2.49, 'pz', '🐈', ''],
  ['animali', 'Lettiera per gatti', 'Pet', '5 L', 3.99, 'pz', '🐾', ''],
];

export const FIRST_NAMES = ['Giuseppe', 'Maria', 'Salvatore', 'Anna', 'Gennaro', 'Carmela', 'Antonio', 'Rosaria', 'Vincenzo', 'Teresa',
  'Nunzia', 'Assunta', 'Francesco', 'Lucia', 'Pasquale', 'Giovanna', 'Raffaele', 'Immacolata', 'Luigi', 'Patrizia',
  'Marco', 'Federica', 'Alessandro', 'Chiara', 'Davide', 'Martina', 'Fabio', 'Valentina', 'Stefano', 'Ilaria'];
export const LAST_NAMES = ['Esposito', 'Russo', 'Romano', 'De Luca', 'Iovine', 'Capasso', 'Ferrara', 'Cozzolino', 'Ruggiero', 'Sorrentino',
  'Coppola', 'Marino', 'Aiello', 'Mele', 'Califano', 'Amato', 'Caruso', 'Gargiulo', 'Palumbo', 'Di Maio'];
export const STREETS = [
  ['Via Cavour', '80020'],
  ['Via Roma', '80020'],
  ['Via Garibaldi', '80020'],
  ['Via Mazzini', '80020'],
  ['Corso Italia', '80020'],
  ['Via Vittorio Emanuele', '80020'],
  ['Via Dante Alighieri', '80020'],
  ['Via Giuseppe Verdi', '80020'],
  ['Via Guglielmo Marconi', '80020'],
  ['Via Petrarca', '80020'],
  ['Via Leopardi', '80020'],
  ['Via Manzoni', '80020'],
  ['Via Pascoli', '80020'],
  ['Via Carducci', '80020'],
];
