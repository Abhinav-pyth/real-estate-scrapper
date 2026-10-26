// Indore locality seed data (release 1 scope: Indore, MP, India ONLY).
// centerLat/centerLng are intentionally NULL here — the seed script geocodes each
// locality via OpenStreetMap Nominatim (an authorized, free geocoding service,
// used within its 1 req/s policy). Coordinates are NEVER hardcoded guesses.

export interface LocalitySeed {
  name: string;
  slug: string;
  aliases: string[];
  pinCodes: string[];
}

export const INDORE_LOCALITIES: LocalitySeed[] = [
  { name: "Vijay Nagar", slug: "vijay-nagar", aliases: ["Vijay Nagar Square"], pinCodes: ["452011"] },
  { name: "Scheme No. 54", slug: "scheme-no-54", aliases: ["Scheme 54", "RWA Scheme No 54"], pinCodes: ["452010"] },
  { name: "Scheme No. 78", slug: "scheme-no-78", aliases: ["Scheme 78", "Vijay Nagar Scheme 78"], pinCodes: ["452010"] },
  { name: "Nipania", slug: "nipania", aliases: ["NIPANIA", "Alpeshh Square area"], pinCodes: ["452010"] },
  { name: "Mahalaxmi Nagar", slug: "mahalaxmi-nagar", aliases: ["Mahalakshmi Nagar"], pinCodes: ["452001"] },
  { name: "Super Corridor", slug: "super-corridor", aliases: ["SU-6", "Super Corridor Road"], pinCodes: ["453771"] },
  { name: "Rau", slug: "rau", aliases: ["Mau", "Rau District"], pinCodes: ["453331"] },
  { name: "Bicholi Mardana", slug: "bicholi-mardana", aliases: ["Bicholi", "Mardana"], pinCodes: ["453111"] },
  { name: "Bengali Square", slug: "bengali-square", aliases: ["Bengali Square Vijay Nagar"], pinCodes: ["452011"] },
  { name: "Kanadia Road", slug: "kanadia-road", aliases: ["Khandwa Road stretch", "Kanakadia"], pinCodes: ["452011"] },
  { name: "AB Road", slug: "ab-road", aliases: ["Atal Bihari Vajpayee Road", "APM Road", "Indore Dewas road"], pinCodes: ["452010"] },
  { name: "MR-10", slug: "mr-10", aliases: ["MR10", "MR 10"], pinCodes: ["452018"] },
  { name: "MR-11", slug: "mr-11", aliases: ["MR11", "MR 11"], pinCodes: ["452011"] },
  { name: "Palasia", slug: "palasia", aliases: ["Old Palasia", "Palasia Terrace"], pinCodes: ["452001"] },
  { name: "New Palasia", slug: "new-palasia", aliases: ["T.T. Nagar near"], pinCodes: ["452003"] },
  { name: "Saket Nagar", slug: "saket-nagar", aliases: ["Shivaji Nagar circle area"], pinCodes: ["452008"] },
  { name: "Sudama Nagar", slug: "sudama-nagar", aliases: [], pinCodes: ["452001"] },
  { name: "Rajendra Nagar", slug: "rajendra-nagar", aliases: ["Rajendra Nagar Biladi"], pinCodes: ["452001"] },
  { name: "Annapurna Road", slug: "annapurna-road", aliases: ["Annapurna Tower road"], pinCodes: ["452003"] },
  { name: "Silicon City", slug: "silicon-city", aliases: ["Silicon City Indore"], pinCodes: ["453774"] },
  { name: "Talawali Chanda", slug: "talawali-chanda", aliases: ["Talawali"], pinCodes: ["453111"] },
  { name: "Lasudia", slug: "lasudia", aliases: ["Lasudiya", "Lasudia Shehar"], pinCodes: ["452101"] },
  { name: "Dewas Naka", slug: "dewas-naka", aliases: ["DEWAS NAKA"], pinCodes: ["452101"] },
  { name: "Ujjain Road", slug: "ujjain-road", aliases: ["NH-59 Ujjain road", "Chhoti Gokul"], pinCodes: ["452010"] },
  { name: "Airport Road", slug: "airport-road", aliases: ["Devgunjan Road", "Indore airport road"], pinCodes: ["452011"] },
  { name: "Ring Road", slug: "ring-road", aliases: ["Indore Ring Road"], pinCodes: [] },
  { name: "Musakhedi", slug: "musakhedi", aliases: ["MUSAKHEDI", "Mukhedi"], pinCodes: ["452101"] },
  { name: "Bhawarkua", slug: "bhawarkua", aliases: ["Bhavarkua", "Bhawar Kuan"], pinCodes: ["452002"] },
  { name: "Khajrana", slug: "khajrana", aliases: ["Khajrana Ganesh"], pinCodes: ["452001"] },
  { name: "Rau-Pithampur Road", slug: "rau-pithampur-road", aliases: ["Pithampur road", "Rau Pithampur"], pinCodes: ["453331"] },
  { name: "Sanwer Road", slug: "sanwer-road", aliases: ["Sanwer", "SH-21"], pinCodes: ["453221"] },
];
