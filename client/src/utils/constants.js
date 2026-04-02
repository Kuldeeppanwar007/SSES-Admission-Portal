export const TRACKS = [
  'Satwas', 'Nemawar', 'Harda', 'Khategaon', 'Kannod',
  'Bherunda', 'Gopalpur', 'Timarni', 'Narmadapuram', 'Seoni Malva',
];

// 4 main tracks with their towns (image ke hisaab se)
export const TRACK_TOWNS = {
  'Harda':           ['HARDA', 'TIMARNI', 'SEONI MALWA'],
  'Khategaon':       ['KHATEGAON', 'NEMAWAR'],
  'Rehti':           ['GOPALPUR', 'BHERUNDA', 'REHTI'],
  'Satwas & Kannod': ['KANNOD', 'SATWAS'],
};

// 4 main tracks for target/dashboard use
export const MAIN_TRACKS = ['Harda', 'Khategaon', 'Rehti', 'Satwas & Kannod'];

export const STATUSES = ['Applied', 'Calling', 'Admitted', 'Rejected', 'Disabled'];

export const STATUS_COLORS = {
  Applied:  'bg-yellow-100 text-yellow-800',
  Calling:  'bg-purple-100 text-purple-800',
  Admitted: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-800',
  Disabled: 'bg-gray-800 text-white',
};

export const ROLES = ['admin', 'manager', 'track_incharge'];
