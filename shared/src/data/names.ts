export const NAME_LISTS: Record<string, { first: string[]; last: string[] }> = {
  human: {
    first: ["Alaric", "Branwen", "Cedric", "Dara", "Edmund", "Fiora", "Garrick", "Helena", "Ivo", "Junia", "Kellan", "Lyra", "Magnus", "Nessa", "Osric", "Petra", "Quentin", "Rosalind", "Soren", "Talia"],
    last: ["Ashdown", "Blackwood", "Cross", "Dunmore", "Everhart", "Fenwick", "Graves", "Holloway", "Ironside", "Kestrel", "Lockhart", "Marsh", "Nightingale", "Osgood", "Pryce", "Quinlan", "Ravenscroft", "Stonebridge", "Thorne", "Wren"],
  },
  "hill-dwarf": {
    first: ["Balin", "Dagna", "Eldeth", "Fargrim", "Gunnloda", "Harbek", "Ilde", "Kildrak", "Morgran", "Nala", "Orsik", "Rurik", "Sannl", "Thorek", "Vondal"],
    last: ["Battlehammer", "Fireforge", "Ironfist", "Ironhelm", "Rockseeker", "Stonebreaker", "Stoutale", "Thunderhand", "Ungart"],
  },
  "high-elf": {
    first: ["Aelar", "Berrian", "Caelynn", "Dael", "Erevan", "Fenren", "Galinndan", "Ivellios", "Keyleth", "Laucian", "Mindartis", "Naivara", "Quarion", "Sariel", "Theriatis"],
    last: ["Amakiir (Gemflower)", "Galanodel (Moonwhisper)", "Holimion (Diamonddew)", "Liadon (Silverfrond)", "Meliamne (Oakenheel)", "Siannodel (Moonbrook)", "Xiloscient (Goldpetal)"],
  },
  "wood-elf": {
    first: ["Adran", "Bereris", "Carric", "Dara", "Elorfindar", "Immeral", "Lucan", "Peren", "Rolen", "Silvyr", "Vanuath"],
    last: ["Greycastle", "Greenbough", "Nightbreeze", "Swiftarrow", "Thistledown", "Wildmane"],
  },
  "lightfoot-halfling": {
    first: ["Alton", "Beau", "Cora", "Della", "Eldon", "Finnan", "Gwen", "Lidda", "Merric", "Paela", "Roscoe", "Wella"],
    last: ["Brushgather", "Goodbarrel", "Greenbottle", "High-hill", "Leagallow", "Tealeaf", "Underbough"],
  },
  dragonborn: {
    first: ["Arjhan", "Balasar", "Bharash", "Donaar", "Ghesh", "Kava", "Medrash", "Nadarr", "Pandjed", "Rhogar", "Shamash", "Tarhun"],
    last: ["Clethtinthiallor", "Daardendrian", "Fenkenkabradon", "Kepeshkmolik", "Nemmonis", "Turnuroth", "Verthisathurgiesh"],
  },
  "forest-gnome": {
    first: ["Alston", "Boddynock", "Dimble", "Fonkin", "Glim", "Namfoodle", "Roondar", "Seebo", "Warryn", "Zook"],
    last: ["Beren", "Daergel", "Folkor", "Garrick", "Nackle", "Raulnor", "Turen"],
  },
  "half-elf": {
    first: ["Aris", "Bryn", "Corwin", "Delara", "Elwin", "Faye", "Halden", "Isolde", "Marlow", "Wrenna"],
    last: ["Amberlight", "Duskwalker", "Fairwind", "Halfmoon", "Riverstone", "Wildwood"],
  },
  "half-orc": {
    first: ["Dench", "Feng", "Gell", "Grumbar", "Krusk", "Mhurren", "Ront", "Shump", "Thokk", "Yevelda"],
    last: ["Bloodfang", "Ironjaw", "Skullcrusher", "Stonefist", "the Grim", "of the Broken Tusk"],
  },
  tiefling: {
    first: ["Akmenos", "Damaia", "Kairon", "Leucis", "Melech", "Mordai", "Nemeia", "Orianna", "Rieta", "Zephyr"],
    last: ["Ashenveil", "Duskblood", "Emberfall", "Nightsorrow", "Shadowbrand", "Vaelthorn"],
  },
};

export function nameListFor(raceId: string): { first: string[]; last: string[] } {
  return NAME_LISTS[raceId] ?? NAME_LISTS.human;
}

export const MONSTER_FIRST_NAMES: string[] = [
  "Grask", "Vorn", "Ykka", "Thren", "Mordo", "Skarl", "Nix", "Brakka", "Zeth", "Ulgar",
  "Krix", "Morra", "Vashka", "Ognar", "Skree", "Thessk", "Drazz", "Gnarl", "Vex", "Karrow",
];

export const MONSTER_EPITHETS: string[] = [
  "the Hungry", "the Pale", "the Unblinking", "of the Hollow", "the Gnasher", "the Ashen", "the Wretched",
  "the Skulking", "of the Deep Roots", "the Many-Scarred", "the Silent", "the Ravenous", "the Broken-Horned",
  "the Nightcrawler", "of the Sunken Vale", "the Grim", "the Foul", "the Restless", "the Cunning", "the Feral",
];
