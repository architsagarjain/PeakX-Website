import type { Diet, Macros } from './types.js';
import { add, scale, ZERO } from './nutrition.js';

/**
 * Indian food table (S10.1).
 *
 * INGREDIENTS: per 100 g edible portion, raw unless the name says cooked. Values follow IFCT 2017
 * (National Institute of Nutrition) rounded to whole numbers. Every row is `reviewed: false` until the
 * PeakX nutrition team checks it against the printed table; the app shows such items as "estimated".
 *
 * DISHES: common Indian dishes built as recipes from those ingredients, one standard serving each,
 * so their numbers always follow the ingredient table.
 */

export type FoodGroup = 'cereal' | 'pulse' | 'dairy' | 'meat' | 'egg' | 'veg' | 'fruit' | 'fat' | 'nut' | 'sugar' | 'other';
export interface Portion { label: string; grams: number }
export interface Ingredient {
  id: string; name: string; aliases: string[]; group: FoodGroup;
  per100g: Macros; portions: Portion[]; reviewed: boolean;
  /** Packaged products only: the brand printed on the pack. Values follow the pack label (per 100 g or 100 ml). */
  brand?: string;
}

const m = (kcal: number, protein: number, carbs: number, fat: number): Macros => ({ kcal, protein, carbs, fat });
const G = (g: number): Portion => ({ label: `${g} g`, grams: g });
const P = (label: string, grams: number): Portion => ({ label, grams });
const ing = (id: string, name: string, group: FoodGroup, per100g: Macros, aliases: string[], portions: Portion[] = [G(100)]): Ingredient =>
  ({ id, name, group, per100g, aliases, portions, reviewed: false });
/** A packaged product. `name` carries the brand so search and the log read naturally ("Quaker Oats"). */
const pack = (id: string, brand: string, name: string, group: FoodGroup, per100g: Macros, aliases: string[], portions: Portion[]): Ingredient =>
  ({ id, name, group, per100g, aliases, portions, reviewed: false, brand });

export const INGREDIENTS: Ingredient[] = [
  // Cereals and flours
  ing('atta', 'Whole-wheat flour (atta)', 'cereal', m(330, 11, 66, 2), ['atta', 'gehun', 'wheat flour'], [G(30), G(100)]),
  ing('maida', 'Refined flour (maida)', 'cereal', m(350, 10, 74, 1), ['maida', 'all purpose flour']),
  ing('rice', 'Rice, raw', 'cereal', m(350, 8, 78, 1), ['chawal', 'rice'], [G(50), G(100)]),
  ing('basmati', 'Basmati rice, raw', 'cereal', m(350, 8, 77, 1), ['basmati'], [G(50), G(75)]),
  ing('brown-rice', 'Brown rice, raw', 'cereal', m(350, 8, 74, 3), ['brown rice'], [G(50)]),
  ing('rice-cooked', 'Rice, cooked', 'cereal', m(130, 3, 28, 0), ['chawal', 'plain rice', 'steamed rice', 'bhaat'], [P('1 katori', 150), P('½ katori', 75), P('1 plate', 250)]),
  ing('poha', 'Flattened rice (poha), raw', 'cereal', m(350, 7, 77, 1), ['poha', 'chivda', 'aval']),
  ing('rava', 'Semolina (rava), raw', 'cereal', m(348, 10, 75, 1), ['rava', 'sooji', 'suji', 'semolina']),
  ing('oats', 'Rolled oats, raw', 'cereal', m(380, 14, 63, 8), ['oats', 'jai'], [P('½ cup', 40), G(100)]),
  ing('besan', 'Gram flour (besan)', 'pulse', m(372, 22, 58, 6), ['besan', 'gram flour', 'chickpea flour']),
  ing('bread', 'White bread', 'cereal', m(265, 9, 49, 3), ['bread', 'double roti', 'pav'], [P('1 slice', 25), P('2 slices', 50)]),
  ing('brown-bread', 'Brown bread', 'cereal', m(250, 9, 45, 3), ['brown bread', 'whole wheat bread', 'atta bread'], [P('1 slice', 25), P('2 slices', 50)]),
  ing('ragi', 'Finger millet (ragi) flour', 'cereal', m(330, 7, 72, 2), ['ragi', 'nachni', 'mandua']),
  ing('bajra', 'Pearl millet (bajra) flour', 'cereal', m(360, 11, 67, 5), ['bajra']),
  ing('jowar', 'Sorghum (jowar) flour', 'cereal', m(334, 10, 67, 2), ['jowar']),
  ing('makki', 'Maize flour (makki atta)', 'cereal', m(350, 9, 73, 4), ['makki', 'makki ka atta', 'maize flour']),
  ing('rice-flour', 'Rice flour', 'cereal', m(360, 6, 80, 1), ['rice flour', 'chawal ka atta']),
  ing('dalia', 'Broken wheat (dalia), raw', 'cereal', m(340, 12, 69, 2), ['dalia', 'broken wheat', 'lapsi'], [G(40), G(100)]),
  ing('sabudana', 'Sago (sabudana), raw', 'cereal', m(350, 0, 87, 0), ['sabudana', 'sago', 'javvarisi']),
  ing('vermicelli', 'Vermicelli (seviyan), raw', 'cereal', m(350, 10, 75, 1), ['seviyan', 'sevai', 'vermicelli', 'semiya']),
  ing('murmura', 'Puffed rice (murmura)', 'cereal', m(370, 7, 82, 1), ['murmura', 'kurmura', 'puffed rice', 'mamra'], [P('1 katori', 15), G(100)]),
  ing('noodles', 'Noodles, raw', 'cereal', m(350, 12, 72, 1), ['noodles', 'hakka noodles raw'], [G(75), G(100)]),
  // Pulses (raw, dry)
  ing('toor', 'Toor dal, raw', 'pulse', m(340, 22, 57, 2), ['arhar', 'toor', 'tuvar', 'pigeon pea'], [G(30), G(100)]),
  ing('moong', 'Moong dal, raw', 'pulse', m(345, 24, 56, 1), ['moong', 'mung', 'green gram'], [G(30), G(100)]),
  ing('masoor', 'Masoor dal, raw', 'pulse', m(343, 24, 59, 1), ['masoor', 'red lentil']),
  ing('chana-dal', 'Chana dal, raw', 'pulse', m(360, 21, 60, 5), ['chana dal', 'bengal gram split']),
  ing('urad', 'Urad dal, raw', 'pulse', m(340, 24, 56, 2), ['urad', 'udad', 'black gram']),
  ing('rajma', 'Rajma, raw', 'pulse', m(333, 23, 60, 1), ['rajma', 'kidney beans']),
  ing('kabuli', 'Kabuli chana, raw', 'pulse', m(360, 19, 61, 6), ['kabuli chana', 'chickpeas', 'chhole', 'safed chana']),
  ing('kala-chana', 'Kala chana, raw', 'pulse', m(360, 18, 60, 5), ['kala chana', 'black chickpeas']),
  ing('soya', 'Soya chunks, dry', 'pulse', m(345, 52, 33, 1), ['soya chunks', 'nutrela', 'soya bari'], [P('1 handful', 25), G(50)]),
  ing('lobia', 'Lobia (black-eyed beans), raw', 'pulse', m(330, 22, 55, 1), ['lobia', 'chawli', 'black eyed peas', 'rongi']),
  ing('roasted-chana', 'Roasted chana', 'pulse', m(370, 22, 58, 5), ['bhuna chana', 'roasted chana', 'phutana', 'dalia chana'], [P('1 handful', 30), G(100)]),
  ing('tofu', 'Tofu', 'pulse', m(100, 10, 2, 6), ['tofu', 'soya paneer'], [G(100)]),
  // Dairy
  ing('milk', 'Milk, toned', 'dairy', m(58, 3, 5, 3), ['doodh', 'milk'], [P('1 glass', 250), P('1 cup', 150), G(100)]),
  ing('milk-full', 'Milk, full cream', 'dairy', m(83, 3, 5, 6), ['full cream milk', 'malai doodh']),
  ing('curd', 'Curd (dahi), toned milk', 'dairy', m(60, 3, 5, 3), ['dahi', 'curd', 'yogurt'], [P('1 katori', 150), P('½ katori', 75)]),
  ing('hung-curd', 'Hung curd', 'dairy', m(80, 8, 4, 4), ['hung curd', 'greek yogurt', 'chakka'], [P('1 katori', 150), G(100)]),
  ing('paneer', 'Paneer', 'dairy', m(265, 18, 1, 21), ['paneer', 'cottage cheese'], [G(50), G(100), P('1 katori cubes', 120)]),
  ing('ghee', 'Ghee', 'fat', m(900, 0, 0, 100), ['ghee', 'desi ghee'], [P('1 tsp', 5), P('1 tbsp', 15)]),
  ing('butter', 'Butter', 'fat', m(717, 1, 0, 81), ['makhan', 'butter'], [P('1 tsp', 5), P('1 tbsp', 14)]),
  ing('cheese', 'Processed cheese', 'dairy', m(300, 18, 6, 23), ['cheese', 'cheese slice'], [P('1 slice', 20)]),
  ing('whey', 'Whey protein powder', 'dairy', m(400, 80, 10, 5), ['whey', 'protein powder', 'protein shake'], [P('1 scoop', 30)]),
  ing('cream', 'Fresh cream (25% fat)', 'dairy', m(250, 2, 3, 25), ['malai', 'cream', 'fresh cream'], [P('1 tbsp', 15), G(100)]),
  ing('khoya', 'Khoya (mawa)', 'dairy', m(420, 15, 20, 31), ['khoya', 'mawa', 'khoa']),
  ing('ice-cream', 'Vanilla ice cream', 'dairy', m(210, 4, 24, 11), ['ice cream', 'icecream', 'vanilla ice cream'], [P('1 scoop', 60), G(100)]),
  // Eggs, meat, fish
  ing('egg', 'Egg, whole', 'egg', m(143, 13, 1, 10), ['anda', 'ande', 'egg', 'eggs'], [P('1 egg', 50), P('2 eggs', 100), P('3 eggs', 150)]),
  ing('egg-white', 'Egg white', 'egg', m(52, 11, 1, 0), ['egg white', 'safedi'], [P('1 egg white', 33), P('3 egg whites', 100)]),
  ing('chicken-breast', 'Chicken breast, raw', 'meat', m(120, 23, 0, 3), ['chicken breast', 'murgh'], [G(100), G(150)]),
  ing('chicken', 'Chicken, curry cut, raw', 'meat', m(180, 19, 0, 12), ['chicken', 'murgh', 'curry cut'], [G(100), G(150)]),
  ing('mutton', 'Mutton, raw', 'meat', m(194, 19, 0, 13), ['mutton', 'gosht', 'goat meat'], [G(100)]),
  ing('rohu', 'Rohu fish, raw', 'meat', m(97, 17, 0, 2), ['rohu', 'fish', 'machli', 'machhi'], [G(100), G(150)]),
  ing('prawns', 'Prawns, raw', 'meat', m(85, 19, 0, 1), ['prawns', 'jhinga', 'shrimp'], [G(100)]),
  ing('chicken-mince', 'Chicken mince (keema), raw', 'meat', m(145, 20, 0, 7), ['chicken keema', 'chicken mince'], [G(100)]),
  ing('mutton-mince', 'Mutton mince (keema), raw', 'meat', m(230, 18, 0, 17), ['mutton keema', 'mutton mince'], [G(100)]),
  ing('pomfret', 'Pomfret, raw', 'meat', m(110, 19, 0, 4), ['pomfret', 'paplet', 'halwa fish'], [G(100), G(150)]),
  ing('surmai', 'King fish (surmai), raw', 'meat', m(120, 21, 0, 4), ['surmai', 'seer fish', 'king fish', 'vanjaram'], [G(100), G(150)]),
  ing('mackerel', 'Mackerel (bangda), raw', 'meat', m(160, 19, 0, 9), ['bangda', 'mackerel', 'ayala'], [G(100)]),
  ing('basa', 'Basa fish, raw', 'meat', m(90, 15, 0, 3), ['basa'], [G(100), G(150)]),
  // Vegetables
  ing('potato', 'Potato', 'veg', m(80, 2, 17, 0), ['aloo', 'alu', 'potato'], [P('1 medium', 100), G(100)]),
  ing('onion', 'Onion', 'veg', m(40, 1, 9, 0), ['pyaaz', 'pyaj', 'kanda', 'onion']),
  ing('tomato', 'Tomato', 'veg', m(20, 1, 4, 0), ['tamatar', 'tomato']),
  ing('spinach', 'Spinach', 'veg', m(23, 3, 4, 0), ['palak', 'spinach']),
  ing('cauliflower', 'Cauliflower', 'veg', m(30, 2, 5, 0), ['gobi', 'phool gobi', 'cauliflower']),
  ing('cabbage', 'Cabbage', 'veg', m(25, 1, 6, 0), ['patta gobi', 'band gobi', 'cabbage']),
  ing('peas', 'Green peas', 'veg', m(81, 5, 15, 0), ['matar', 'peas']),
  ing('okra', 'Okra (bhindi)', 'veg', m(33, 2, 7, 0), ['bhindi', 'lady finger', 'okra']),
  ing('brinjal', 'Brinjal', 'veg', m(25, 1, 6, 0), ['baingan', 'brinjal', 'eggplant']),
  ing('capsicum', 'Capsicum', 'veg', m(26, 1, 6, 0), ['shimla mirch', 'capsicum', 'bell pepper']),
  ing('carrot', 'Carrot', 'veg', m(41, 1, 10, 0), ['gajar', 'carrot']),
  ing('cucumber', 'Cucumber', 'veg', m(15, 1, 4, 0), ['kheera', 'kakdi', 'cucumber'], [P('1 medium', 150), G(100)]),
  ing('mixed-veg', 'Mixed vegetables', 'veg', m(45, 2, 8, 0), ['mixed veg', 'sabzi', 'vegetables']),
  ing('lauki', 'Bottle gourd (lauki)', 'veg', m(15, 1, 3, 0), ['lauki', 'ghiya', 'dudhi', 'bottle gourd']),
  ing('mushroom', 'Mushroom', 'veg', m(22, 3, 3, 0), ['mushroom', 'khumb']),
  ing('methi', 'Fenugreek leaves (methi)', 'veg', m(49, 4, 6, 1), ['methi', 'fenugreek leaves']),
  ing('sarson', 'Mustard greens (sarson)', 'veg', m(30, 3, 4, 0), ['sarson', 'mustard greens']),
  ing('karela', 'Bitter gourd (karela)', 'veg', m(25, 2, 4, 0), ['karela', 'bitter gourd', 'pavakkai']),
  ing('tinda', 'Round gourd (tinda)', 'veg', m(21, 1, 4, 0), ['tinda', 'round gourd', 'apple gourd']),
  ing('arbi', 'Colocasia (arbi)', 'veg', m(100, 3, 21, 0), ['arbi', 'arvi', 'colocasia', 'taro']),
  ing('pumpkin', 'Pumpkin (kaddu)', 'veg', m(25, 1, 5, 0), ['kaddu', 'sitaphal', 'pumpkin']),
  ing('beans', 'French beans', 'veg', m(30, 2, 6, 0), ['beans', 'french beans', 'fansi']),
  ing('sweet-potato', 'Sweet potato', 'veg', m(120, 1, 28, 0), ['shakarkandi', 'sweet potato'], [P('1 medium', 130), G(100)]),
  ing('sweet-corn', 'Sweet corn kernels', 'veg', m(90, 3, 19, 1), ['sweet corn', 'bhutta', 'makai', 'corn'], [P('1 cup', 150), G(100)]),
  ing('mooli', 'Radish (mooli)', 'veg', m(18, 1, 4, 0), ['mooli', 'radish']),
  // Fruit
  ing('banana', 'Banana', 'fruit', m(98, 1, 23, 0), ['kela', 'banana'], [P('1 medium', 100)]),
  ing('apple', 'Apple', 'fruit', m(59, 0, 14, 0), ['seb', 'apple'], [P('1 medium', 150)]),
  ing('mango', 'Mango', 'fruit', m(74, 1, 17, 0), ['aam', 'mango'], [P('1 cup slices', 165)]),
  ing('papaya', 'Papaya', 'fruit', m(40, 1, 10, 0), ['papita', 'papaya'], [P('1 katori', 150)]),
  ing('orange', 'Orange', 'fruit', m(48, 1, 12, 0), ['santra', 'narangi', 'orange'], [P('1 medium', 130)]),
  ing('pomegranate', 'Pomegranate', 'fruit', m(83, 2, 19, 1), ['anar', 'pomegranate'], [P('1 katori', 100)]),
  ing('guava', 'Guava', 'fruit', m(55, 2, 11, 1), ['amrood', 'amrud', 'guava'], [P('1 medium', 100)]),
  ing('watermelon', 'Watermelon', 'fruit', m(30, 1, 8, 0), ['tarbooz', 'tarbuj', 'watermelon'], [P('1 katori', 150)]),
  ing('grapes', 'Grapes', 'fruit', m(70, 1, 17, 0), ['angoor', 'grapes'], [P('1 katori', 100)]),
  ing('pineapple', 'Pineapple', 'fruit', m(50, 1, 13, 0), ['ananas', 'pineapple'], [P('1 katori', 150)]),
  ing('chikoo', 'Chikoo (sapota)', 'fruit', m(94, 1, 24, 1), ['chikoo', 'chiku', 'sapota'], [P('1 medium', 100)]),
  ing('dates', 'Dates (khajoor)', 'fruit', m(280, 2, 75, 0), ['khajoor', 'khajur', 'dates'], [P('1 date', 8), P('3 dates', 24)]),
  ing('coconut-water', 'Coconut water', 'other', m(20, 0, 5, 0), ['nariyal pani', 'coconut water', 'daab'], [P('1 glass', 250)]),
  // Fats, nuts, sugar
  ing('oil', 'Cooking oil', 'fat', m(900, 0, 0, 100), ['tel', 'oil', 'refined oil', 'mustard oil'], [P('1 tsp', 5), P('1 tbsp', 15)]),
  ing('peanuts', 'Peanuts', 'nut', m(570, 25, 26, 49), ['moongphali', 'mungfali', 'peanuts'], [P('1 handful', 30)]),
  ing('almonds', 'Almonds', 'nut', m(580, 21, 22, 50), ['badam', 'almonds'], [P('10 almonds', 12)]),
  ing('peanut-butter', 'Peanut butter', 'nut', m(590, 25, 20, 50), ['peanut butter'], [P('1 tbsp', 16)]),
  ing('coconut', 'Coconut, fresh', 'nut', m(400, 4, 15, 37), ['nariyal', 'coconut']),
  ing('coconut-milk', 'Coconut milk', 'nut', m(200, 2, 3, 21), ['coconut milk', 'nariyal doodh'], [P('½ cup', 100)]),
  ing('cashew', 'Cashews', 'nut', m(590, 18, 30, 47), ['kaju', 'cashew', 'cashews'], [P('10 cashews', 15)]),
  ing('walnut', 'Walnuts', 'nut', m(650, 15, 14, 65), ['akhrot', 'walnut', 'walnuts'], [P('2 walnuts', 10)]),
  ing('makhana', 'Fox nuts (makhana)', 'nut', m(350, 10, 77, 0), ['makhana', 'fox nuts', 'phool makhana', 'lotus seeds'], [P('1 katori', 20)]),
  ing('chia', 'Chia seeds', 'nut', m(490, 17, 42, 31), ['chia', 'chia seeds'], [P('1 tbsp', 12)]),
  ing('flax', 'Flaxseeds (alsi)', 'nut', m(534, 18, 29, 42), ['alsi', 'flaxseed', 'flax seeds'], [P('1 tbsp', 10)]),
  ing('sugar', 'Sugar', 'sugar', m(400, 0, 100, 0), ['cheeni', 'shakkar', 'sugar'], [P('1 tsp', 5)]),
  ing('jaggery', 'Jaggery', 'sugar', m(380, 0, 95, 0), ['gud', 'gur', 'jaggery'], [P('1 piece', 10)]),
  ing('honey', 'Honey', 'sugar', m(320, 0, 80, 0), ['shahad', 'honey'], [P('1 tsp', 7)]),

  // Branded packaged products. Per 100 g (or 100 ml for drinks) as printed on Indian packs, rounded.
  // Recipes change, so these stay "estimated" until the team checks each against a current pack.
  // Oats and cereals
  pack('quaker-oats', 'Quaker', 'Quaker Oats', 'cereal', m(389, 12, 66, 8), ['quaker'], [P('1 serving · 40 g', 40)]),
  pack('saffola-oats', 'Saffola', 'Saffola Oats', 'cereal', m(385, 12, 67, 8), ['saffola'], [P('1 serving · 40 g', 40)]),
  pack('saffola-masala-oats', 'Saffola', 'Saffola Masala Oats, classic masala', 'cereal', m(380, 10, 67, 8), ['masala oats'], [P('1 pack · 40 g', 40)]),
  pack('kelloggs-corn-flakes', "Kellogg's", "Kellogg's Corn Flakes", 'cereal', m(380, 7, 85, 1), ['kelloggs', 'cornflakes', 'corn flakes'], [P('1 bowl · 30 g', 30)]),
  pack('kelloggs-chocos', "Kellogg's", "Kellogg's Chocos", 'cereal', m(387, 8, 82, 3), ['chocos'], [P('1 bowl · 30 g', 30)]),
  pack('kelloggs-muesli', "Kellogg's", "Kellogg's Muesli, fruit, nut & seeds", 'cereal', m(380, 9, 74, 5), ['muesli', 'museli'], [P('1 bowl · 45 g', 45)]),
  pack('yogabar-muesli', 'Yoga Bar', 'Yoga Bar Muesli, fruit & nut', 'cereal', m(400, 11, 65, 11), ['yogabar muesli'], [P('1 bowl · 45 g', 45)]),
  // Protein
  pack('on-whey', 'Optimum Nutrition', 'Optimum Nutrition Gold Standard Whey', 'dairy', m(395, 79, 10, 5), ['on whey', 'gold standard', 'optimum nutrition'], [P('1 scoop · 30 g', 30)]),
  pack('mb-biozyme', 'MuscleBlaze', 'MuscleBlaze Biozyme Performance Whey', 'dairy', m(385, 76, 11, 4), ['muscleblaze', 'biozyme', 'mb whey'], [P('1 scoop · 33 g', 33)]),
  pack('mb-raw-whey', 'MuscleBlaze', 'MuscleBlaze Raw Whey Protein', 'dairy', m(400, 80, 8, 6), ['raw whey', 'mb raw whey'], [P('1 scoop · 30 g', 30)]),
  pack('yogabar-protein-bar', 'Yoga Bar', 'Yoga Bar 20 g Protein Bar', 'other', m(380, 33, 40, 12), ['yogabar', 'yoga bar', 'protein bar'], [P('1 bar · 60 g', 60)]),
  pack('ritebite-max-protein', 'RiteBite', 'RiteBite Max Protein Daily bar', 'other', m(400, 20, 50, 13), ['ritebite', 'max protein'], [P('1 bar · 50 g', 50)]),
  pack('whole-truth-protein-bar', 'The Whole Truth', 'The Whole Truth Protein Bar', 'other', m(440, 29, 35, 21), ['whole truth'], [P('1 bar · 52 g', 52)]),
  // Milk, curd, paneer, butter, cheese
  pack('amul-taaza', 'Amul', 'Amul Taaza toned milk', 'dairy', m(58, 3, 5, 3), ['amul taaza', 'taaza', 'amul milk'], [P('1 glass · 250 ml', 250), P('1 cup · 150 ml', 150)]),
  pack('amul-gold', 'Amul', 'Amul Gold full cream milk', 'dairy', m(88, 3, 5, 6), ['amul gold'], [P('1 glass · 250 ml', 250), P('1 cup · 150 ml', 150)]),
  pack('amul-slim-trim', 'Amul', "Amul Slim 'n' Trim skimmed milk", 'dairy', m(35, 4, 5, 0), ['slim n trim', 'skimmed milk', 'skim milk'], [P('1 glass · 250 ml', 250)]),
  pack('mother-dairy-toned', 'Mother Dairy', 'Mother Dairy toned milk', 'dairy', m(58, 3, 5, 3), ['mother dairy'], [P('1 glass · 250 ml', 250), P('1 cup · 150 ml', 150)]),
  pack('amul-masti-dahi', 'Amul', 'Amul Masti Dahi', 'dairy', m(64, 4, 5, 3), ['masti dahi', 'amul dahi', 'amul curd'], [P('1 katori · 150 g', 150)]),
  pack('epigamia-greek', 'Epigamia', 'Epigamia Greek Yogurt, natural', 'dairy', m(80, 7, 5, 3), ['epigamia'], [P('1 cup · 90 g', 90)]),
  pack('amul-paneer', 'Amul', 'Amul Malai Paneer', 'dairy', m(288, 18, 4, 22), ['amul paneer'], [G(50), G(100), P('1 pack · 200 g', 200)]),
  pack('amul-butter', 'Amul', 'Amul Butter', 'fat', m(722, 1, 0, 80), ['amul butter'], [P('1 tsp', 5), P('1 tbsp', 14)]),
  pack('amul-cheese-slice', 'Amul', 'Amul cheese slice', 'dairy', m(310, 20, 2, 25), ['amul cheese'], [P('1 slice · 20 g', 20)]),
  pack('yakult', 'Yakult', 'Yakult', 'dairy', m(77, 1, 18, 0), ['yakult'], [P('1 bottle · 65 ml', 65)]),
  // Instant noodles and frozen
  pack('maggi-masala', 'Maggi', 'Maggi 2-Minute Masala Noodles', 'cereal', m(440, 9, 63, 16), ['maggi', 'maggie', 'maggi noodles', 'instant noodles'], [P('1 pack · 70 g', 70)]),
  pack('mccain-fries', 'McCain', 'McCain French Fries, frozen', 'veg', m(150, 2, 22, 5), ['mccain', 'french fries', 'fries'], [P('1 serving · 100 g', 100)]),
  // Biscuits
  pack('parle-g', 'Parle', 'Parle-G biscuits', 'cereal', m(450, 7, 77, 12), ['parle g', 'parleg', 'parle'], [P('1 biscuit', 6), P('4 biscuits', 24)]),
  pack('marie-gold', 'Britannia', 'Britannia Marie Gold', 'cereal', m(440, 8, 76, 11), ['marie', 'marie gold', 'marie biscuit'], [P('1 biscuit', 6), P('4 biscuits', 24)]),
  pack('nutrichoice-digestive', 'Britannia', 'Britannia NutriChoice Digestive', 'cereal', m(476, 8, 66, 20), ['nutrichoice', 'digestive biscuit'], [P('1 biscuit', 13), P('3 biscuits', 39)]),
  pack('good-day', 'Britannia', 'Britannia Good Day cashew cookies', 'cereal', m(505, 7, 63, 25), ['good day', 'goodday'], [P('1 biscuit', 10), P('4 biscuits', 40)]),
  pack('bourbon', 'Britannia', 'Britannia Bourbon', 'cereal', m(480, 5, 70, 20), ['bourbon'], [P('1 biscuit', 12), P('3 biscuits', 36)]),
  pack('oreo', 'Cadbury', 'Oreo cookies', 'cereal', m(480, 5, 70, 20), ['oreo'], [P('1 biscuit', 11), P('3 biscuits', 33)]),
  pack('dark-fantasy', 'Sunfeast', 'Sunfeast Dark Fantasy Choco Fills', 'cereal', m(495, 6, 64, 24), ['dark fantasy'], [P('1 cookie', 12.5), P('2 cookies', 25)]),
  pack('monaco', 'Parle', 'Parle Monaco', 'cereal', m(510, 8, 63, 25), ['monaco'], [P('5 biscuits', 22)]),
  // Namkeen and chips
  pack('haldiram-bhujia', "Haldiram's", "Haldiram's Aloo Bhujia", 'other', m(556, 11, 42, 38), ['aloo bhujia', 'bhujia', 'haldiram', 'haldirams'], [P('1 handful · 30 g', 30)]),
  pack('haldiram-moong-dal', "Haldiram's", "Haldiram's Moong Dal namkeen", 'other', m(535, 22, 42, 31), ['moong dal namkeen'], [P('1 handful · 30 g', 30)]),
  pack('lays-classic', "Lay's", "Lay's Classic Salted chips", 'other', m(544, 7, 53, 34), ['lays', 'lay s', 'chips', 'potato chips'], [P('1 handful · 20 g', 20), P('1 pack · 50 g', 50)]),
  pack('kurkure', 'Kurkure', 'Kurkure Masala Munch', 'other', m(555, 6, 57, 34), ['kurkure'], [P('1 handful · 20 g', 20), P('1 pack · 75 g', 75)]),
  // Spreads and sauces
  pack('pintola-pb', 'Pintola', 'Pintola All Natural Peanut Butter', 'nut', m(630, 30, 16, 50), ['pintola'], [P('1 tbsp', 16), P('2 tbsp', 32)]),
  pack('myfitness-pb', 'MyFitness', 'MyFitness Chocolate Peanut Butter', 'nut', m(600, 26, 26, 45), ['myfitness', 'my fitness'], [P('1 tbsp', 16), P('2 tbsp', 32)]),
  pack('nutella', 'Ferrero', 'Nutella', 'sugar', m(539, 6, 58, 31), ['nutella'], [P('1 tbsp', 15)]),
  pack('kissan-jam', 'Kissan', 'Kissan Mixed Fruit Jam', 'sugar', m(270, 0, 67, 0), ['kissan', 'jam'], [P('1 tbsp', 20)]),
  pack('kissan-ketchup', 'Kissan', 'Kissan Tomato Ketchup', 'sugar', m(120, 1, 29, 0), ['ketchup', 'tomato ketchup'], [P('1 tbsp', 15)]),
  pack('funfoods-mayo', 'Dr. Oetker FunFoods', 'FunFoods Veg Mayonnaise', 'fat', m(510, 1, 10, 52), ['mayo', 'mayonnaise', 'veg mayo', 'funfoods'], [P('1 tbsp', 15)]),
  // Health drinks, soft drinks, juices
  pack('bournvita', 'Cadbury', 'Cadbury Bournvita', 'sugar', m(384, 7, 85, 2), ['bournvita'], [P('1 serving · 20 g', 20)]),
  pack('horlicks', 'Horlicks', 'Horlicks Classic Malt', 'cereal', m(380, 11, 78, 2), ['horlicks'], [P('1 serving · 27 g', 27)]),
  pack('coca-cola', 'Coca-Cola', 'Coca-Cola', 'sugar', m(44, 0, 11, 0), ['coke', 'coca cola', 'cola'], [P('1 can · 300 ml', 300), P('1 glass · 250 ml', 250)]),
  pack('thums-up', 'Coca-Cola', 'Thums Up', 'sugar', m(44, 0, 11, 0), ['thumbs up', 'thums up'], [P('1 can · 300 ml', 300), P('1 glass · 250 ml', 250)]),
  pack('sprite', 'Coca-Cola', 'Sprite', 'sugar', m(40, 0, 10, 0), ['sprite'], [P('1 can · 300 ml', 300), P('1 glass · 250 ml', 250)]),
  pack('coke-zero', 'Coca-Cola', 'Coke Zero / Diet Coke', 'other', m(0, 0, 0, 0), ['diet coke', 'coke zero', 'zero sugar cola'], [P('1 can · 300 ml', 300)]),
  pack('frooti', 'Parle Agro', 'Frooti', 'sugar', m(66, 0, 16, 0), ['frooti', 'mango drink'], [P('1 glass · 200 ml', 200)]),
  pack('maaza', 'Coca-Cola', 'Maaza', 'sugar', m(65, 0, 16, 0), ['maaza'], [P('1 glass · 200 ml', 200)]),
  pack('red-bull', 'Red Bull', 'Red Bull energy drink', 'sugar', m(46, 0, 11, 0), ['redbull', 'red bull', 'energy drink'], [P('1 can · 250 ml', 250)]),
  pack('tropicana-orange', 'Tropicana', 'Tropicana 100% Orange juice', 'fruit', m(45, 1, 10, 0), ['tropicana', 'packaged orange juice'], [P('1 glass · 200 ml', 200)]),
  // Chocolates
  pack('dairy-milk', 'Cadbury', 'Cadbury Dairy Milk', 'sugar', m(534, 8, 57, 30), ['dairy milk', 'dairymilk', 'cadbury'], [P('1 small bar · 13 g', 13), P('1 bar · 50 g', 50)]),
  pack('kitkat', 'Nestlé', 'Nestlé KitKat', 'sugar', m(518, 7, 62, 27), ['kitkat', 'kit kat'], [P('1 bar · 37 g', 37)]),
];

const BY_ID = new Map(INGREDIENTS.map((i) => [i.id, i]));
export function ingredient(id: string): Ingredient {
  const i = BY_ID.get(id);
  if (!i) throw new Error(`Unknown ingredient ${id}`);
  return i;
}

export interface Dish {
  id: string; name: string; aliases: string[];
  serving: string;                      // label for one serving, e.g. "1 katori · 150 g"
  parts: [string, number][];            // [ingredient id, grams] for one serving
  portions: Portion[];                  // labels with grams = multiples of one serving (grams field = servings × 100)
}

/** Portions for dishes are stored as servings × 100 so they share the Portion shape. */
const S = (label: string, servings: number): Portion => ({ label, grams: Math.round(servings * 100) });
const KATORI = [S('½ katori', 0.5), S('1 katori', 1), S('1½ katori', 1.5), S('2 katori', 2)];
const PIECES = (one: string, many: string) => [S(`1 ${one}`, 1), S(`2 ${many}`, 2), S(`3 ${many}`, 3), S(`4 ${many}`, 4)];
const PLATE = [S('½ plate', 0.5), S('1 plate', 1), S('1½ plate', 1.5)];
const dish = (id: string, name: string, aliases: string[], serving: string, parts: string, portions: Portion[] = KATORI): Dish => ({
  id, name, aliases, serving, portions,
  parts: parts.split(' ').map((p) => { const [k, g] = p.split(':'); return [k, Number(g)] as [string, number]; }),
});

export const DISHES: Dish[] = [
  // Breads
  dish('roti', 'Roti', ['chapati', 'phulka', 'rotis', 'fulka'], '1 medium', 'atta:30', PIECES('roti', 'roti')),
  dish('ghee-roti', 'Roti with ghee', ['ghee roti', 'chapati with ghee'], '1 medium', 'atta:30 ghee:3', PIECES('roti', 'roti')),
  dish('paratha', 'Plain paratha', ['paratha', 'parantha'], '1 paratha', 'atta:45 oil:7', PIECES('paratha', 'paratha')),
  dish('aloo-paratha', 'Aloo paratha', ['aloo parantha', 'potato paratha'], '1 paratha', 'atta:50 potato:60 oil:8', PIECES('paratha', 'paratha')),
  dish('paneer-paratha', 'Paneer paratha', ['paneer parantha'], '1 paratha', 'atta:50 paneer:40 oil:8', PIECES('paratha', 'paratha')),
  dish('naan', 'Butter naan', ['naan', 'nan'], '1 naan', 'maida:70 curd:10 butter:5', PIECES('naan', 'naan')),
  // Rice
  dish('plain-rice', 'Plain rice', ['chawal', 'steamed rice', 'bhaat'], '1 katori · 150 g', 'rice-cooked:150'),
  dish('jeera-rice', 'Jeera rice', ['jeera rice', 'cumin rice'], '1 katori · 150 g', 'rice-cooked:150 ghee:4'),
  dish('veg-pulao', 'Veg pulao', ['pulao', 'pulav'], '1 katori · 180 g', 'rice:55 mixed-veg:60 oil:5'),
  dish('chicken-biryani', 'Chicken biryani', ['biryani', 'murgh biryani'], '1 plate', 'basmati:75 chicken:100 onion:40 curd:20 oil:10', PLATE),
  dish('veg-biryani', 'Veg biryani', ['veg biryani', 'subz biryani'], '1 plate', 'basmati:75 mixed-veg:80 curd:20 oil:10', PLATE),
  dish('khichdi', 'Moong dal khichdi', ['khichdi', 'khichri'], '1 katori · 200 g', 'rice:40 moong:25 ghee:5'),
  // Dals and curries
  dish('dal-tadka', 'Dal tadka', ['dal', 'daal', 'toor dal', 'arhar dal', 'dal fry'], '1 katori · 150 g', 'toor:35 onion:15 tomato:20 ghee:5'),
  dish('moong-dal', 'Moong dal', ['moong daal', 'yellow dal'], '1 katori · 150 g', 'moong:35 onion:15 tomato:20 oil:5'),
  dish('dal-makhani', 'Dal makhani', ['dal makhni', 'maa ki dal'], '1 katori · 150 g', 'urad:30 rajma:8 butter:6 milk-full:20 tomato:30 ghee:2'),
  dish('rajma', 'Rajma', ['rajma masala', 'rajma curry'], '1 katori · 150 g', 'rajma:45 onion:20 tomato:30 oil:5'),
  dish('chole', 'Chole', ['chhole', 'chana masala', 'chole masala'], '1 katori · 150 g', 'kabuli:45 onion:20 tomato:30 oil:6'),
  dish('sambar', 'Sambar', ['sambhar'], '1 katori · 150 g', 'toor:20 mixed-veg:60 tomato:20 oil:3'),
  dish('kadhi', 'Kadhi', ['kadi', 'kadhi pakora'], '1 katori · 150 g', 'besan:15 curd:100 oil:4'),
  dish('palak-paneer', 'Palak paneer', ['saag paneer'], '1 katori · 150 g', 'spinach:120 paneer:60 onion:15 oil:6'),
  dish('paneer-butter-masala', 'Paneer butter masala', ['paneer makhani', 'shahi paneer'], '1 katori · 150 g', 'paneer:80 tomato:50 butter:8 milk-full:20 onion:20'),
  dish('matar-paneer', 'Matar paneer', ['mutter paneer'], '1 katori · 150 g', 'paneer:60 peas:50 tomato:40 onion:20 oil:6'),
  dish('paneer-bhurji', 'Paneer bhurji', ['paneer bhurjee'], '1 katori · 120 g', 'paneer:80 onion:30 tomato:30 oil:5'),
  dish('chicken-curry', 'Chicken curry', ['murgh curry', 'chicken gravy'], '1 katori · 200 g', 'chicken:120 onion:40 tomato:40 oil:8'),
  dish('butter-chicken', 'Butter chicken', ['murgh makhani'], '1 katori · 200 g', 'chicken-breast:120 tomato:50 butter:10 milk-full:30'),
  dish('egg-curry', 'Egg curry', ['anda curry', 'ande ki sabzi'], '2 eggs with gravy', 'egg:100 onion:30 tomato:40 oil:6', [S('1 egg', 0.5), S('2 eggs', 1), S('3 eggs', 1.5)]),
  dish('fish-curry', 'Fish curry', ['machli curry', 'machhi'], '1 katori · 200 g', 'rohu:120 onion:30 tomato:30 oil:8'),
  dish('mutton-curry', 'Mutton curry', ['gosht', 'mutton gravy'], '1 katori · 200 g', 'mutton:120 onion:40 tomato:30 oil:8'),
  // Sabzis
  dish('aloo-gobi', 'Aloo gobi', ['aloo gobhi'], '1 katori · 150 g', 'potato:70 cauliflower:80 oil:6'),
  dish('bhindi', 'Bhindi masala', ['bhindi', 'bhindi fry', 'okra'], '1 katori · 120 g', 'okra:120 onion:20 oil:7'),
  dish('baingan-bharta', 'Baingan bharta', ['bharta'], '1 katori · 150 g', 'brinjal:150 onion:25 tomato:25 oil:6'),
  dish('mix-veg', 'Mixed veg sabzi', ['sabzi', 'mix veg', 'mixed vegetable'], '1 katori · 150 g', 'mixed-veg:150 oil:6'),
  dish('jeera-aloo', 'Jeera aloo', ['aloo sabzi', 'aloo ki sabzi'], '1 katori · 120 g', 'potato:120 oil:6'),
  dish('lauki-sabzi', 'Lauki sabzi', ['ghiya', 'dudhi sabzi'], '1 katori · 150 g', 'lauki:150 tomato:20 oil:4'),
  // Grills and eggs
  dish('chicken-tikka', 'Chicken tikka', ['tikka'], '6 pieces · 150 g', 'chicken-breast:150 curd:30 oil:5', [S('3 pieces', 0.5), S('6 pieces', 1), S('9 pieces', 1.5)]),
  dish('tandoori-chicken', 'Tandoori chicken', ['tandoori'], '2 leg pieces', 'chicken:200 curd:30 oil:5', [S('1 piece', 0.5), S('2 pieces', 1), S('4 pieces', 2)]),
  dish('egg-bhurji', 'Egg bhurji', ['anda bhurji', 'scrambled eggs'], '2 eggs', 'egg:100 onion:20 tomato:20 oil:5', [S('2 eggs', 1), S('3 eggs', 1.5), S('4 eggs', 2)]),
  dish('boiled-eggs', 'Boiled eggs', ['ubla anda', 'boiled egg'], '2 eggs', 'egg:100', [S('1 egg', 0.5), S('2 eggs', 1), S('3 eggs', 1.5), S('4 eggs', 2)]),
  dish('omelette', 'Masala omelette', ['omelette', 'omlet', 'amlet'], '2 eggs', 'egg:100 onion:15 oil:5', [S('2 eggs', 1), S('3 eggs', 1.5)]),
  // Breakfast and snacks
  dish('poha-dish', 'Poha', ['kanda poha', 'poha'], '1 plate', 'poha:50 onion:20 peanuts:8 oil:5', PLATE),
  dish('upma', 'Upma', ['rava upma', 'sooji upma'], '1 plate', 'rava:50 onion:15 mixed-veg:30 oil:6', PLATE),
  dish('idli', 'Idli', ['idly'], '2 idli', 'rice:40 urad:13', [S('2 idli', 1), S('3 idli', 1.5), S('4 idli', 2)]),
  dish('dosa', 'Plain dosa', ['dosa', 'sada dosa'], '1 dosa', 'rice:50 urad:15 oil:5', [S('1 dosa', 1), S('2 dosa', 2)]),
  dish('masala-dosa', 'Masala dosa', ['masala dosai'], '1 dosa', 'rice:50 urad:15 potato:80 onion:15 oil:8', [S('1 dosa', 1), S('2 dosa', 2)]),
  dish('besan-chilla', 'Besan chilla', ['cheela', 'chilla'], '2 chilla', 'besan:50 onion:20 oil:5', [S('1 chilla', 0.5), S('2 chilla', 1), S('3 chilla', 1.5)]),
  dish('moong-chilla', 'Moong dal chilla', ['moong cheela', 'pesarattu'], '2 chilla', 'moong:50 oil:5', [S('1 chilla', 0.5), S('2 chilla', 1), S('3 chilla', 1.5)]),
  dish('oats-porridge', 'Oats with milk', ['oatmeal', 'daliya', 'porridge'], '1 bowl', 'oats:40 milk:200', [S('1 bowl', 1), S('½ bowl', 0.5)]),
  dish('veg-sandwich', 'Veg sandwich', ['sandwich'], '1 sandwich', 'bread:50 cucumber:30 tomato:30 butter:5', [S('1 sandwich', 1), S('2 sandwiches', 2)]),
  dish('paneer-sandwich', 'Paneer sandwich', ['paneer toast'], '1 sandwich', 'bread:50 paneer:40 butter:5', [S('1 sandwich', 1), S('2 sandwiches', 2)]),
  dish('pb-toast', 'Peanut butter toast', ['pb toast'], '2 slices', 'brown-bread:50 peanut-butter:16', [S('1 slice', 0.5), S('2 slices', 1)]),
  dish('samosa', 'Samosa', ['samosa'], '1 samosa', 'maida:30 potato:50 oil:12', PIECES('samosa', 'samosas')),
  dish('pakora', 'Onion pakora', ['pakoda', 'bhajiya', 'pakore'], '1 plate · 6 pieces', 'besan:40 onion:50 oil:15', PLATE),
  dish('chana-chaat', 'Chana chaat', ['chaat', 'chickpea salad'], '1 katori · 150 g', 'kala-chana:50 onion:20 tomato:20'),
  dish('sprouts', 'Sprouts salad', ['sprouts', 'ankurit moong'], '1 katori · 120 g', 'moong:40 onion:15 tomato:15 cucumber:30'),
  // Curd and drinks
  dish('curd-bowl', 'Curd', ['dahi', 'katori dahi'], '1 katori · 150 g', 'curd:150'),
  dish('raita', 'Cucumber raita', ['raita', 'raitha'], '1 katori · 160 g', 'curd:120 cucumber:40'),
  dish('chai', 'Masala chai', ['chai', 'tea', 'chaay'], '1 cup', 'milk:100 sugar:6', [S('1 cup', 1), S('2 cups', 2), S('1 cup, no sugar', 0.85)]),
  dish('coffee', 'Coffee with milk', ['coffee', 'filter coffee'], '1 cup', 'milk:150 sugar:5', [S('1 cup', 1), S('2 cups', 2)]),
  dish('lassi', 'Sweet lassi', ['lassi'], '1 glass', 'curd:200 sugar:15', [S('1 glass', 1), S('½ glass', 0.5)]),
  dish('banana-shake', 'Banana shake', ['banana milkshake', 'kela shake'], '1 glass', 'milk:250 banana:100 sugar:5', [S('1 glass', 1), S('½ glass', 0.5)]),
  dish('whey-shake', 'Whey shake (with water)', ['protein shake', 'whey'], '1 scoop', 'whey:30', [S('1 scoop', 1), S('2 scoops', 2)]),

  // ---- Added Nov 2026: wider Indian coverage ----
  // Chicken
  dish('kadai-chicken', 'Kadai chicken', ['karahi chicken', 'kadhai chicken'], '1 katori · 200 g', 'chicken:120 capsicum:40 onion:30 tomato:40 oil:10'),
  dish('chicken-tikka-masala', 'Chicken tikka masala', ['tikka masala', 'murgh tikka masala'], '1 katori · 200 g', 'chicken-breast:120 tomato:50 onion:30 cream:15 oil:8'),
  dish('chicken-korma', 'Chicken korma', ['murgh korma', 'chicken qorma'], '1 katori · 200 g', 'chicken:120 onion:50 curd:40 cashew:10 oil:10'),
  dish('chicken-do-pyaza', 'Chicken do pyaza', ['chicken dopiaza', 'murgh do pyaza'], '1 katori · 200 g', 'chicken:120 onion:80 tomato:30 oil:10'),
  dish('chicken-chettinad', 'Chicken chettinad', ['chettinad chicken'], '1 katori · 200 g', 'chicken:120 onion:40 tomato:30 coconut:15 oil:10'),
  dish('palak-chicken', 'Palak chicken', ['saag chicken', 'chicken saagwala', 'murgh palak'], '1 katori · 200 g', 'chicken:120 spinach:100 onion:30 oil:8'),
  dish('chicken-keema', 'Chicken keema', ['chicken kheema', 'chicken mince curry', 'chicken keema matar'], '1 katori · 180 g', 'chicken-mince:120 onion:40 tomato:40 peas:20 oil:8'),
  dish('chicken-65', 'Chicken 65', ['chicken sixty five'], '1 plate · 150 g', 'chicken-breast:120 maida:15 curd:15 oil:15', PLATE),
  dish('chilli-chicken', 'Chilli chicken', ['chili chicken', 'chilly chicken'], '1 plate · 200 g', 'chicken-breast:120 maida:15 capsicum:40 onion:30 oil:15', PLATE),
  dish('chicken-lollipop', 'Chicken lollipop', ['lollipop chicken'], '4 pieces', 'chicken:120 maida:15 oil:15', [S('2 pieces', 0.5), S('4 pieces', 1), S('6 pieces', 1.5)]),
  dish('chicken-noodles', 'Chicken hakka noodles', ['chicken chowmein', 'chicken noodles'], '1 plate', 'noodles:75 chicken-breast:60 cabbage:40 capsicum:20 oil:12', PLATE),
  dish('chicken-momos', 'Chicken momos', ['chicken momo', 'chicken dumplings'], '6 pieces', 'maida:60 chicken-mince:60 onion:15 oil:2', [S('3 pieces', 0.5), S('6 pieces', 1), S('10 pieces', 10 / 6)]),
  dish('chicken-roll', 'Chicken kathi roll', ['chicken roll', 'chicken frankie', 'kathi roll'], '1 roll', 'maida:60 chicken-breast:80 onion:20 oil:10', [S('1 roll', 1), S('2 rolls', 2)]),
  dish('chicken-shawarma', 'Chicken shawarma', ['shawarma', 'shawarma roll'], '1 roll', 'maida:60 chicken:90 cabbage:20 curd:15 oil:10', [S('1 roll', 1), S('2 rolls', 2)]),
  dish('chicken-soup', 'Chicken soup', ['chicken clear soup', 'chicken shorba'], '1 bowl', 'chicken-breast:50 mixed-veg:40 oil:3', [S('1 bowl', 1), S('2 bowls', 2)]),
  dish('chicken-stew', 'Kerala chicken stew', ['chicken ishtu', 'chicken stew'], '1 katori · 200 g', 'chicken:120 potato:50 coconut-milk:60 onion:20 oil:5'),
  // Mutton
  dish('rogan-josh', 'Rogan josh', ['mutton rogan josh', 'roganjosh'], '1 katori · 200 g', 'mutton:120 curd:40 onion:30 oil:10'),
  dish('mutton-keema', 'Mutton keema', ['keema', 'kheema', 'qeema', 'keema curry'], '1 katori · 180 g', 'mutton-mince:120 onion:40 tomato:40 oil:6'),
  dish('keema-matar', 'Keema matar', ['kheema matar', 'keema mutter'], '1 katori · 180 g', 'mutton-mince:100 peas:50 onion:30 tomato:30 oil:6'),
  dish('mutton-korma', 'Mutton korma', ['gosht korma'], '1 katori · 200 g', 'mutton:120 onion:50 curd:40 cashew:10 oil:10'),
  dish('bhuna-gosht', 'Bhuna gosht', ['mutton bhuna', 'bhuna mutton'], '1 katori · 180 g', 'mutton:130 onion:50 tomato:30 oil:12'),
  dish('nihari', 'Nihari', ['mutton nihari', 'nalli nihari'], '1 katori · 200 g', 'mutton:130 atta:10 onion:30 ghee:10'),
  dish('laal-maas', 'Laal maas', ['lal maas', 'rajasthani mutton'], '1 katori · 200 g', 'mutton:120 curd:30 onion:30 ghee:12'),
  // Fish and seafood
  dish('prawn-masala', 'Prawn masala', ['prawn curry', 'jhinga masala', 'chingri', 'shrimp curry'], '1 katori · 200 g', 'prawns:120 onion:40 tomato:40 oil:10'),
  dish('goan-fish-curry', 'Goan fish curry', ['coconut fish curry', 'fish curry rice goan'], '1 katori · 200 g', 'surmai:120 coconut-milk:60 onion:20 oil:5'),
  dish('machher-jhol', 'Machher jhol', ['maacher jhol', 'bengali fish curry', 'fish jhol'], '1 katori · 200 g', 'rohu:120 potato:40 tomato:20 oil:10'),
  dish('fish-fry', 'Tawa fish fry', ['fish fry', 'rava fish fry', 'surmai fry'], '2 pieces · 120 g', 'surmai:120 rava:10 oil:10', [S('1 piece', 0.5), S('2 pieces', 1), S('4 pieces', 2)]),
  dish('amritsari-fish', 'Amritsari fish', ['amritsari fish fry', 'fish pakora'], '1 plate', 'basa:120 besan:25 oil:15', PLATE),
  dish('pomfret-fry', 'Pomfret fry', ['paplet fry', 'pomfret tawa fry'], '1 fish', 'pomfret:150 rava:10 oil:10', [S('1 fish', 1), S('2 fish', 2)]),
  dish('bangda-fry', 'Bangda fry', ['mackerel fry', 'ayala fry'], '1 fish', 'mackerel:120 rava:10 oil:8', [S('1 fish', 1), S('2 fish', 2)]),
  // Grills, kebabs and lean protein
  dish('chicken-seekh-kebab', 'Chicken seekh kebab', ['chicken seekh', 'seekh kabab', 'seekh kebab'], '2 seekh', 'chicken-mince:120 onion:20 oil:5', [S('1 seekh', 0.5), S('2 seekh', 1), S('4 seekh', 2)]),
  dish('mutton-seekh-kebab', 'Mutton seekh kebab', ['mutton seekh', 'mutton kebab'], '2 seekh', 'mutton-mince:120 onion:20 oil:3', [S('1 seekh', 0.5), S('2 seekh', 1), S('4 seekh', 2)]),
  dish('chicken-malai-tikka', 'Chicken malai tikka', ['malai tikka', 'reshmi kebab', 'murgh malai tikka'], '6 pieces · 150 g', 'chicken-breast:150 cream:20 cheese:10 oil:5', [S('3 pieces', 0.5), S('6 pieces', 1), S('9 pieces', 1.5)]),
  dish('grilled-chicken', 'Grilled chicken breast', ['grilled chicken', 'chicken breast grilled', 'boiled chicken'], '150 g cooked', 'chicken-breast:150 oil:5', [S('100 g', 2 / 3), S('150 g', 1), S('200 g', 4 / 3), S('250 g', 5 / 3)]),
  dish('fish-tikka', 'Fish tikka', ['machli tikka', 'tandoori fish'], '6 pieces · 150 g', 'basa:150 curd:30 oil:5', [S('3 pieces', 0.5), S('6 pieces', 1), S('9 pieces', 1.5)]),
  dish('grilled-fish', 'Grilled fish', ['grilled basa', 'baked fish'], '150 g', 'basa:150 oil:5', [S('100 g', 2 / 3), S('150 g', 1), S('200 g', 4 / 3)]),
  dish('paneer-tikka', 'Paneer tikka', ['paneer tikka dry', 'tandoori paneer'], '6 pieces · 150 g', 'paneer:120 capsicum:30 onion:20 curd:20 oil:5', [S('3 pieces', 0.5), S('6 pieces', 1), S('9 pieces', 1.5)]),
  dish('egg-white-omelette', 'Egg white omelette', ['egg white omelet', 'safedi omelette'], '3 egg whites', 'egg-white:100 onion:15 oil:3', [S('3 egg whites', 1), S('6 egg whites', 2)]),
  // Paneer and veg curries
  dish('kadai-paneer', 'Kadai paneer', ['karahi paneer', 'kadhai paneer'], '1 katori · 150 g', 'paneer:80 capsicum:40 onion:30 tomato:40 oil:8'),
  dish('paneer-tikka-masala', 'Paneer tikka masala', ['paneer tikka gravy'], '1 katori · 150 g', 'paneer:80 tomato:50 onion:30 cream:15 oil:8'),
  dish('paneer-do-pyaza', 'Paneer do pyaza', ['paneer dopiaza'], '1 katori · 150 g', 'paneer:80 onion:60 tomato:30 oil:8'),
  dish('chilli-paneer', 'Chilli paneer', ['chili paneer', 'chilly paneer'], '1 plate · 180 g', 'paneer:100 maida:10 capsicum:40 onion:30 oil:12', PLATE),
  dish('malai-kofta', 'Malai kofta', ['kofta curry', 'paneer kofta'], '1 katori · 180 g', 'paneer:40 potato:40 maida:5 cream:20 cashew:10 tomato:40 oil:12'),
  dish('navratan-korma', 'Navratan korma', ['veg korma', 'navrattan korma'], '1 katori · 150 g', 'mixed-veg:100 paneer:20 cream:15 cashew:10 oil:8'),
  dish('dum-aloo', 'Dum aloo', ['kashmiri dum aloo', 'dum aloo curry'], '1 katori · 150 g', 'potato:130 curd:30 oil:10'),
  dish('aloo-matar', 'Aloo matar', ['aloo mutter', 'aloo matar curry'], '1 katori · 150 g', 'potato:80 peas:50 tomato:40 onion:20 oil:6'),
  dish('methi-malai-matar', 'Methi malai matar', ['methi matar malai'], '1 katori · 150 g', 'peas:70 methi:40 cream:25 cashew:5 oil:6'),
  dish('sarson-saag', 'Sarson ka saag', ['saag', 'sarson da saag', 'sarson saag'], '1 katori · 150 g', 'sarson:150 spinach:50 makki:10 ghee:8'),
  dish('mushroom-masala', 'Mushroom masala', ['mushroom curry', 'kadai mushroom'], '1 katori · 150 g', 'mushroom:120 onion:30 tomato:40 oil:7'),
  dish('matar-mushroom', 'Matar mushroom', ['mutter mushroom'], '1 katori · 150 g', 'mushroom:80 peas:50 tomato:40 onion:20 oil:6'),
  dish('veg-kolhapuri', 'Veg kolhapuri', ['vegetable kolhapuri'], '1 katori · 150 g', 'mixed-veg:130 coconut:10 onion:20 oil:8'),
  dish('soya-curry', 'Soya chunks curry', ['soya chunk curry', 'nutrela curry', 'soya sabzi'], '1 katori · 150 g', 'soya:30 onion:30 tomato:40 oil:6'),
  dish('tofu-bhurji', 'Tofu bhurji', ['tofu scramble'], '1 katori · 120 g', 'tofu:100 onion:30 tomato:30 oil:5'),
  dish('gatte-ki-sabzi', 'Gatte ki sabzi', ['gatte', 'besan gatte', 'gatte curry'], '1 katori · 150 g', 'besan:40 curd:60 oil:10'),
  // Dals and lentils
  dish('dal-palak', 'Dal palak', ['palak dal', 'spinach dal'], '1 katori · 150 g', 'toor:30 spinach:60 onion:15 ghee:5'),
  dish('masoor-dal', 'Masoor dal', ['lal masoor', 'red lentil dal', 'masoor ki dal'], '1 katori · 150 g', 'masoor:35 onion:15 tomato:20 oil:5'),
  dish('chana-dal-fry', 'Chana dal fry', ['chane ki dal', 'chana dal tadka'], '1 katori · 150 g', 'chana-dal:35 onion:15 tomato:20 ghee:5'),
  dish('urad-dal', 'Urad dal', ['dhuli urad', 'maah ki dal', 'urad dal tadka'], '1 katori · 150 g', 'urad:35 onion:15 ghee:5'),
  dish('sabut-moong', 'Whole moong dal', ['sabut moong', 'green moong dal', 'moong masala'], '1 katori · 150 g', 'moong:35 onion:15 tomato:20 oil:5'),
  dish('panchmel-dal', 'Panchmel dal', ['panchratna dal', 'mixed dal'], '1 katori · 150 g', 'toor:10 moong:8 masoor:6 chana-dal:6 urad:5 tomato:20 ghee:5'),
  dish('gujarati-dal', 'Gujarati dal', ['khatti meethi dal', 'gujarati toor dal'], '1 katori · 150 g', 'toor:25 jaggery:5 tomato:20 ghee:4'),
  dish('lobia-curry', 'Lobia curry', ['lobia masala', 'chawli curry', 'rongi masala'], '1 katori · 150 g', 'lobia:45 onion:20 tomato:30 oil:5'),
  dish('kala-chana-curry', 'Kala chana curry', ['kala chana masala', 'black chana curry'], '1 katori · 150 g', 'kala-chana:45 onion:20 tomato:30 oil:5'),
  dish('rasam', 'Rasam', ['saaru', 'chaaru', 'tomato rasam'], '1 katori · 150 g', 'toor:8 tomato:50 oil:2'),
  // More sabzis
  dish('aloo-methi', 'Aloo methi', ['methi aloo'], '1 katori · 120 g', 'potato:80 methi:50 oil:6'),
  dish('karela-sabzi', 'Karela sabzi', ['karela fry', 'bitter gourd sabzi'], '1 katori · 100 g', 'karela:100 onion:20 oil:8'),
  dish('tinda-masala', 'Tinda masala', ['tinde ki sabzi', 'tinda sabzi'], '1 katori · 150 g', 'tinda:150 tomato:20 oil:5'),
  dish('arbi-fry', 'Arbi fry', ['arbi masala', 'arvi fry', 'arbi sabzi'], '1 katori · 120 g', 'arbi:120 oil:8'),
  dish('kaddu-sabzi', 'Kaddu ki sabzi', ['khatta meetha kaddu', 'pumpkin sabzi', 'sitaphal sabzi'], '1 katori · 150 g', 'pumpkin:150 jaggery:5 oil:5'),
  dish('cabbage-sabzi', 'Patta gobi sabzi', ['cabbage sabzi', 'band gobi sabzi', 'cabbage matar'], '1 katori · 150 g', 'cabbage:130 peas:20 oil:5'),
  dish('beans-sabzi', 'Beans sabzi', ['beans poriyal', 'french beans sabzi', 'beans thoran'], '1 katori · 150 g', 'beans:130 coconut:10 oil:5'),
  dish('aloo-shimla', 'Aloo shimla mirch', ['aloo capsicum'], '1 katori · 150 g', 'potato:70 capsicum:70 oil:6'),
  dish('gobi-matar', 'Gobi matar', ['gobhi matar', 'gobi mutter'], '1 katori · 150 g', 'cauliflower:100 peas:40 oil:6'),
  dish('avial', 'Avial', ['aviyal'], '1 katori · 150 g', 'mixed-veg:130 coconut:15 curd:30 oil:5'),
  dish('veg-stew', 'Kerala veg stew', ['veg stew', 'vegetable ishtu'], '1 katori · 180 g', 'mixed-veg:120 coconut-milk:60 oil:3'),
  // More breads
  dish('tandoori-roti', 'Tandoori roti', ['tandoor roti', 'tandoori rotis'], '1 roti', 'atta:45', PIECES('roti', 'roti')),
  dish('rumali-roti', 'Rumali roti', ['roomali roti'], '1 roti', 'maida:40 oil:2', PIECES('roti', 'roti')),
  dish('garlic-naan', 'Garlic naan', ['garlic nan', 'lehsuni naan'], '1 naan', 'maida:70 curd:10 butter:8', PIECES('naan', 'naan')),
  dish('lachha-paratha', 'Lachha paratha', ['laccha paratha', 'lachha parantha'], '1 paratha', 'atta:50 ghee:10', PIECES('paratha', 'paratha')),
  dish('puri', 'Puri', ['poori', 'puris'], '1 puri', 'atta:20 oil:5', PIECES('puri', 'puri')),
  dish('bhatura', 'Bhatura', ['bhature', 'bhaturey'], '1 bhatura', 'maida:60 curd:10 oil:12', PIECES('bhatura', 'bhature')),
  dish('kulcha', 'Amritsari kulcha', ['kulcha', 'aloo kulcha', 'stuffed kulcha'], '1 kulcha', 'maida:70 potato:50 butter:8', PIECES('kulcha', 'kulcha')),
  dish('gobi-paratha', 'Gobi paratha', ['gobhi paratha', 'gobi parantha'], '1 paratha', 'atta:50 cauliflower:60 oil:8', PIECES('paratha', 'paratha')),
  dish('methi-paratha', 'Methi paratha', ['methi parantha'], '1 paratha', 'atta:50 methi:30 oil:8', PIECES('paratha', 'paratha')),
  dish('mooli-paratha', 'Mooli paratha', ['mooli parantha', 'radish paratha'], '1 paratha', 'atta:50 mooli:60 oil:8', PIECES('paratha', 'paratha')),
  dish('egg-paratha', 'Egg paratha', ['anda paratha', 'egg parantha'], '1 paratha', 'atta:50 egg:50 oil:8', PIECES('paratha', 'paratha')),
  dish('thepla', 'Methi thepla', ['thepla', 'theplas'], '1 thepla', 'atta:30 methi:15 besan:5 oil:4', PIECES('thepla', 'thepla')),
  dish('missi-roti', 'Missi roti', ['besan roti'], '1 roti', 'atta:20 besan:20 ghee:3', PIECES('roti', 'roti')),
  dish('makki-roti', 'Makki ki roti', ['makki di roti', 'makki roti', 'makki rotis'], '1 roti', 'makki:50 ghee:5', PIECES('roti', 'roti')),
  dish('bajra-roti', 'Bajra roti', ['bajre ki roti', 'bajra bhakri'], '1 roti', 'bajra:40', PIECES('roti', 'roti')),
  dish('jowar-roti', 'Jowar roti', ['jowar bhakri', 'jolada rotti'], '1 roti', 'jowar:40', PIECES('roti', 'roti')),
  dish('ragi-roti', 'Ragi roti', ['nachni bhakri', 'ragi rotti'], '1 roti', 'ragi:40', PIECES('roti', 'roti')),
  // More rice
  dish('mutton-biryani', 'Mutton biryani', ['gosht biryani'], '1 plate', 'basmati:75 mutton:100 onion:40 curd:20 oil:10', PLATE),
  dish('egg-biryani', 'Egg biryani', ['anda biryani'], '1 plate', 'basmati:75 egg:100 onion:40 curd:20 oil:10', PLATE),
  dish('veg-fried-rice', 'Veg fried rice', ['fried rice'], '1 plate', 'rice-cooked:200 mixed-veg:60 oil:10', PLATE),
  dish('egg-fried-rice', 'Egg fried rice', ['egg rice'], '1 plate', 'rice-cooked:200 egg:100 mixed-veg:30 oil:10', PLATE),
  dish('chicken-fried-rice', 'Chicken fried rice', ['chicken rice'], '1 plate', 'rice-cooked:200 chicken-breast:60 egg:25 mixed-veg:30 oil:10', PLATE),
  dish('lemon-rice', 'Lemon rice', ['chitranna', 'nimbu chawal'], '1 katori · 180 g', 'rice-cooked:150 peanuts:10 oil:6'),
  dish('curd-rice', 'Curd rice', ['thayir sadam', 'dahi chawal', 'mosaranna'], '1 katori · 200 g', 'rice-cooked:120 curd:80 oil:3'),
  dish('tamarind-rice', 'Puliyogare', ['pulihora', 'tamarind rice', 'puliyodarai'], '1 katori · 180 g', 'rice-cooked:150 peanuts:10 oil:8'),
  dish('tomato-rice', 'Tomato rice', ['thakkali sadam', 'tomato bath'], '1 katori · 180 g', 'rice-cooked:150 tomato:50 oil:6'),
  dish('bisi-bele-bath', 'Bisi bele bath', ['bisibelebath', 'sambar rice'], '1 plate', 'rice:45 toor:20 mixed-veg:50 ghee:8', PLATE),
  dish('pongal', 'Ven pongal', ['pongal', 'khara pongal'], '1 katori · 200 g', 'rice:40 moong:15 ghee:8 cashew:5'),
  // South Indian and quick breakfasts
  dish('uttapam', 'Onion uttapam', ['uttapam', 'oothappam', 'uthappam'], '1 uttapam', 'rice:45 urad:15 onion:30 oil:6', [S('1 uttapam', 1), S('2 uttapam', 2)]),
  dish('medu-vada', 'Medu vada', ['vada', 'vadai', 'uddina vada'], '2 vada', 'urad:40 oil:12', [S('1 vada', 0.5), S('2 vada', 1), S('3 vada', 1.5)]),
  dish('rava-dosa', 'Rava dosa', ['rava dosai', 'sooji dosa'], '1 dosa', 'rava:30 rice-flour:20 oil:8', [S('1 dosa', 1), S('2 dosa', 2)]),
  dish('appam', 'Appam', ['palappam', 'hoppers'], '2 appam', 'rice:50 coconut:10', [S('1 appam', 0.5), S('2 appam', 1), S('3 appam', 1.5)]),
  dish('sabudana-khichdi', 'Sabudana khichdi', ['sago khichdi', 'sabudana'], '1 plate', 'sabudana:60 potato:40 peanuts:15 ghee:6', PLATE),
  dish('dhokla', 'Khaman dhokla', ['dhokla', 'khaman'], '4 pieces', 'besan:40 oil:4 sugar:4', [S('2 pieces', 0.5), S('4 pieces', 1), S('6 pieces', 1.5)]),
  dish('veg-daliya', 'Veg daliya', ['namkeen daliya', 'vegetable dalia', 'dalia khichdi'], '1 bowl', 'dalia:45 mixed-veg:50 ghee:4', [S('½ bowl', 0.5), S('1 bowl', 1)]),
  dish('semiya-upma', 'Vermicelli upma', ['semiya upma', 'seviyan upma'], '1 plate', 'vermicelli:50 onion:15 mixed-veg:30 oil:6', PLATE),
  dish('overnight-oats', 'Overnight oats', ['overnight oat', 'oats jar'], '1 jar', 'oats:40 milk:150 chia:10 banana:50', [S('1 jar', 1), S('½ jar', 0.5)]),
  dish('ragi-porridge', 'Ragi porridge', ['ragi malt', 'ragi ambli', 'nachni satva'], '1 glass', 'ragi:30 milk:150 jaggery:8', [S('1 glass', 1), S('½ glass', 0.5)]),
  dish('bread-omelette', 'Bread omelette', ['bread omelet', 'bread anda'], '2 eggs + 2 slices', 'egg:100 bread:50 onion:15 oil:5 butter:5', [S('1 serving', 1), S('2 servings', 2)]),
  dish('egg-sandwich', 'Egg sandwich', ['anda sandwich', 'egg mayo sandwich'], '1 sandwich', 'bread:50 egg:50 butter:5 onion:10', [S('1 sandwich', 1), S('2 sandwiches', 2)]),
  // Street food and Indo-Chinese
  dish('pav-bhaji', 'Pav bhaji', ['pav bhaaji', 'paav bhaji'], '1 plate (2 pav)', 'mixed-veg:120 potato:60 butter:15 bread:60', PLATE),
  dish('vada-pav', 'Vada pav', ['wada pav', 'vada paav'], '1 vada pav', 'bread:40 potato:70 besan:15 oil:10', PIECES('vada pav', 'vada pav')),
  dish('misal-pav', 'Misal pav', ['misal', 'misal paav'], '1 plate (2 pav)', 'moong:35 onion:20 tomato:20 bread:60 besan:10 oil:12', PLATE),
  dish('pani-puri', 'Pani puri', ['golgappa', 'gol gappe', 'golgappe', 'puchka', 'phuchka'], '6 puri', 'maida:20 potato:30 kabuli:10 oil:8', [S('6 puri', 1), S('12 puri', 2)]),
  dish('bhel-puri', 'Bhel puri', ['bhel', 'jhal muri', 'jhalmuri'], '1 plate', 'murmura:30 onion:20 tomato:20 potato:20 besan:10 oil:4', PLATE),
  dish('aloo-tikki', 'Aloo tikki', ['tikki', 'aloo tikki chaat'], '2 tikki', 'potato:120 bread:10 oil:10', [S('1 tikki', 0.5), S('2 tikki', 1), S('4 tikki', 2)]),
  dish('dahi-vada', 'Dahi vada', ['dahi bhalla', 'dahi bhalle', 'dahi vade'], '2 vada', 'urad:30 curd:100 oil:8 sugar:5', [S('1 vada', 0.5), S('2 vada', 1)]),
  dish('kachori', 'Kachori', ['khasta kachori', 'pyaz kachori', 'dal kachori'], '1 kachori', 'maida:30 moong:10 oil:12', PIECES('kachori', 'kachori')),
  dish('bread-pakora', 'Bread pakora', ['bread pakoda'], '1 piece', 'bread:40 besan:20 potato:30 oil:10', PIECES('piece', 'pieces')),
  dish('veg-cutlet', 'Veg cutlet', ['vegetable cutlet', 'cutlet'], '2 cutlets', 'potato:60 mixed-veg:40 bread:10 oil:10', [S('1 cutlet', 0.5), S('2 cutlets', 1), S('4 cutlets', 2)]),
  dish('dabeli', 'Dabeli', ['kutchi dabeli'], '1 dabeli', 'bread:40 potato:60 peanuts:10 oil:6', PIECES('dabeli', 'dabeli')),
  dish('veg-momos', 'Veg momos', ['momos', 'momo', 'veg momo', 'dumplings'], '6 pieces', 'maida:60 cabbage:50 carrot:20 oil:3', [S('3 pieces', 0.5), S('6 pieces', 1), S('10 pieces', 10 / 6)]),
  dish('veg-noodles', 'Veg hakka noodles', ['hakka noodles', 'chowmein', 'chow mein', 'veg chowmein'], '1 plate', 'noodles:75 cabbage:40 capsicum:20 carrot:20 oil:12', PLATE),
  dish('veg-manchurian', 'Veg manchurian', ['manchurian', 'veg manchurian gravy'], '1 katori · 150 g', 'cabbage:70 carrot:20 maida:20 oil:12'),
  dish('gobi-manchurian', 'Gobi manchurian', ['cauliflower manchurian', 'gobi 65'], '1 plate', 'cauliflower:120 maida:20 oil:15', PLATE),
  dish('spring-roll', 'Veg spring roll', ['spring roll', 'spring rolls'], '2 rolls', 'maida:30 cabbage:40 carrot:20 oil:12', [S('1 roll', 0.5), S('2 rolls', 1), S('4 rolls', 2)]),
  dish('paneer-roll', 'Paneer kathi roll', ['paneer roll', 'paneer frankie'], '1 roll', 'maida:60 paneer:60 onion:20 oil:10', [S('1 roll', 1), S('2 rolls', 2)]),
  dish('egg-roll', 'Egg roll', ['anda roll', 'egg frankie', 'egg kathi roll'], '1 roll', 'maida:60 egg:50 onion:20 oil:10', [S('1 roll', 1), S('2 rolls', 2)]),
  // Thalis and combos
  dish('chole-bhature', 'Chole bhature', ['chole bhatura', 'chhole bhature'], '1 plate (2 bhature)', 'kabuli:45 onion:20 tomato:30 maida:120 curd:20 oil:30', PLATE),
  dish('rajma-chawal', 'Rajma chawal', ['rajma rice'], '1 plate', 'rajma:45 onion:20 tomato:30 oil:5 rice-cooked:200', PLATE),
  dish('dal-chawal', 'Dal chawal', ['dal rice', 'dal bhaat'], '1 plate', 'toor:35 onion:15 tomato:20 ghee:5 rice-cooked:200', PLATE),
  dish('kadhi-chawal', 'Kadhi chawal', ['kadhi rice'], '1 plate', 'besan:15 curd:100 oil:4 rice-cooked:200', PLATE),
  dish('puri-sabzi', 'Puri sabzi', ['aloo puri', 'puri bhaji', 'poori sabzi'], '1 plate (4 puri)', 'atta:80 potato:100 oil:26', PLATE),
  dish('veg-thali', 'Veg thali', ['thali', 'veg meal'], '1 thali', 'toor:30 ghee:5 mixed-veg:120 oil:10 atta:60 rice-cooked:150 curd:100', [S('1 thali', 1)]),
  // Healthy snacks
  dish('roasted-makhana', 'Roasted makhana', ['makhana snack', 'masala makhana'], '1 katori · 20 g', 'makhana:20 ghee:3', [S('1 katori', 1), S('2 katori', 2)]),
  dish('roasted-chana-snack', 'Roasted chana snack', ['chana jor', 'masala chana'], '1 handful · 30 g', 'roasted-chana:30', [S('1 handful', 1), S('2 handfuls', 2)]),
  dish('peanut-chaat', 'Peanut chaat', ['moongphali chaat', 'masala peanuts'], '1 katori · 80 g', 'peanuts:40 onion:20 tomato:20'),
  dish('fruit-chaat', 'Fruit chaat', ['fruit salad', 'fruit bowl'], '1 bowl', 'apple:60 banana:50 papaya:60 pomegranate:30', [S('1 bowl', 1), S('½ bowl', 0.5)]),
  dish('corn-chaat', 'Sweet corn chaat', ['corn chaat', 'masala corn', 'butter corn'], '1 cup', 'sweet-corn:120 butter:5', [S('1 cup', 1), S('2 cups', 2)]),
  dish('dry-fruits', 'Dry fruits mix', ['mixed nuts', 'trail mix', 'dry fruits'], '1 handful · 30 g', 'almonds:10 cashew:10 walnut:10', [S('1 handful', 1), S('2 handfuls', 2)]),
  // Sweets and desserts
  dish('gulab-jamun', 'Gulab jamun', ['gulabjamun', 'gulab jamuns'], '2 pieces', 'khoya:30 maida:8 sugar:24 oil:10', [S('1 piece', 0.5), S('2 pieces', 1), S('4 pieces', 2)]),
  dish('rasgulla', 'Rasgulla', ['rosogolla', 'rasagola', 'rasgulle'], '2 pieces', 'paneer:40 sugar:30', [S('1 piece', 0.5), S('2 pieces', 1), S('4 pieces', 2)]),
  dish('rasmalai', 'Rasmalai', ['ras malai'], '2 pieces', 'paneer:40 milk-full:80 sugar:20', [S('1 piece', 0.5), S('2 pieces', 1)]),
  dish('kheer', 'Rice kheer', ['kheer', 'payasam', 'chawal ki kheer', 'firni', 'phirni'], '1 katori · 150 g', 'milk-full:150 rice:12 sugar:15'),
  dish('seviyan', 'Seviyan kheer', ['seviyan', 'sevaiyan', 'semiya payasam'], '1 katori · 150 g', 'milk-full:150 vermicelli:15 sugar:15 ghee:3'),
  dish('gajar-halwa', 'Gajar ka halwa', ['gajar halwa', 'carrot halwa'], '1 katori · 120 g', 'carrot:100 milk-full:60 khoya:15 sugar:20 ghee:8'),
  dish('sooji-halwa', 'Sooji halwa', ['suji halwa', 'sheera', 'rava kesari', 'halwa'], '1 katori · 100 g', 'rava:30 ghee:15 sugar:25'),
  dish('moong-dal-halwa', 'Moong dal halwa', ['moong halwa'], '1 katori · 100 g', 'moong:30 ghee:20 sugar:25 milk-full:30'),
  dish('besan-ladoo', 'Besan ladoo', ['besan laddu', 'ladoo', 'laddu'], '1 ladoo', 'besan:15 ghee:8 sugar:12', PIECES('ladoo', 'ladoo')),
  dish('motichoor-ladoo', 'Motichoor ladoo', ['boondi ladoo', 'motichur laddu'], '1 ladoo', 'besan:12 sugar:15 oil:8', PIECES('ladoo', 'ladoo')),
  dish('jalebi', 'Jalebi', ['jilebi', 'jalebis'], '2 pieces · 50 g', 'maida:15 sugar:25 oil:10', [S('2 pieces', 1), S('4 pieces', 2)]),
  dish('kaju-katli', 'Kaju katli', ['kaju barfi', 'kaju katri'], '2 pieces', 'cashew:15 sugar:10', [S('1 piece', 0.5), S('2 pieces', 1), S('4 pieces', 2)]),
  dish('barfi', 'Milk barfi', ['barfi', 'burfi', 'khoya barfi', 'peda'], '1 piece', 'khoya:20 sugar:8', PIECES('piece', 'pieces')),
  dish('shrikhand', 'Shrikhand', ['amrakhand'], '1 katori · 120 g', 'hung-curd:100 sugar:20'),
  dish('kulfi', 'Malai kulfi', ['kulfi', 'matka kulfi'], '1 kulfi', 'milk-full:100 khoya:10 sugar:12', [S('1 kulfi', 1), S('2 kulfi', 2)]),
  dish('mishti-doi', 'Mishti doi', ['mishti dahi', 'sweet curd'], '1 katori · 100 g', 'curd:100 sugar:15'),
  // More drinks
  dish('chaas', 'Chaas', ['buttermilk', 'chhach', 'mattha', 'majjiga', 'masala chaas'], '1 glass', 'curd:80', [S('1 glass', 1), S('2 glasses', 2)]),
  dish('salted-lassi', 'Salted lassi', ['namkeen lassi', 'salt lassi'], '1 glass', 'curd:200', [S('1 glass', 1), S('½ glass', 0.5)]),
  dish('nimbu-pani', 'Nimbu pani', ['shikanji', 'lemonade', 'nimbu soda', 'lemon water'], '1 glass', 'sugar:15', [S('1 glass', 1), S('2 glasses', 2)]),
  dish('mango-shake', 'Mango shake', ['mango milkshake', 'aam shake'], '1 glass', 'milk:200 mango:100 sugar:10', [S('1 glass', 1), S('½ glass', 0.5)]),
  dish('cold-coffee', 'Cold coffee', ['iced coffee'], '1 glass', 'milk:200 sugar:15 ice-cream:30', [S('1 glass', 1), S('½ glass', 0.5)]),
  dish('badam-milk', 'Badam milk', ['badam doodh', 'badam shake'], '1 glass', 'milk:200 almonds:10 sugar:10', [S('1 glass', 1), S('½ glass', 0.5)]),
  dish('haldi-doodh', 'Haldi doodh', ['turmeric milk', 'golden milk', 'haldi wala doodh'], '1 glass', 'milk:200 jaggery:5', [S('1 glass', 1)]),
  dish('sugarcane-juice', 'Sugarcane juice', ['ganne ka ras', 'ganna juice', 'ganne ka juice'], '1 glass', 'sugar:45', [S('1 glass', 1), S('½ glass', 0.5)]),
  dish('orange-juice', 'Fresh orange juice', ['santra juice', 'orange juice'], '1 glass', 'orange:220', [S('1 glass', 1), S('½ glass', 0.5)]),
  dish('whey-milk-shake', 'Whey shake with milk', ['whey with milk', 'protein shake with milk'], '1 glass', 'whey:30 milk:250', [S('1 glass', 1), S('2 glasses', 2)]),
  dish('pb-banana-shake', 'Peanut butter banana shake', ['pb banana shake', 'peanut butter shake'], '1 glass', 'milk:250 banana:100 peanut-butter:16', [S('1 glass', 1), S('½ glass', 0.5)]),
];

/** Macros for one serving of a dish, from the ingredient table. */
export function dishMacros(d: Dish): Macros {
  return d.parts.reduce((s, [id, g]) => add(s, scale(ingredient(id).per100g, g / 100)), ZERO);
}

const MEAT = new Set<FoodGroup>(['meat']);
export function dishDiet(d: Dish): Diet {
  const groups = d.parts.map(([id]) => ingredient(id));
  if (groups.some((i) => MEAT.has(i.group))) return 'nonveg';
  if (groups.some((i) => i.group === 'egg')) return 'egg';
  if (groups.some((i) => i.group === 'dairy' || i.id === 'ghee' || i.id === 'butter' || i.id === 'honey')) return 'veg';
  return 'vegan';
}
