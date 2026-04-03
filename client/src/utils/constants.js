export const TRACKS = [
  'Satwas & Kannod', 'Harda', 'Khategaon', 'Rehti',
];

export const TRACK_TOWNS = {
  'Harda':           ['Harda', 'Timarni', 'Seoni Malwa'],
  'Khategaon':       ['Khategaon', 'Nemawar', 'Sandalpur'],
  'Rehti':           ['Rehti', 'Gopalpur', 'Bherunda'],
  'Satwas & Kannod': ['Satwas', 'Kannod'],
};

// Town se Main Track mapping
export const TOWN_TO_MAIN_TRACK = {
  'Harda':           'Harda',
  'Timarni':         'Harda',
  'Seoni Malwa':     'Harda',
  'Khategaon':       'Khategaon',
  'Nemawar':         'Khategaon',
  'Sandalpur':       'Khategaon', // Corrected to Khategaon
  'Rehti':           'Rehti',
  'Gopalpur':        'Rehti',
  'Bherunda':        'Rehti',
  'Satwas':          'Satwas & Kannod',
  'Kannod':          'Satwas & Kannod',
};

// 4 main tracks
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
