export const TRACKS = [
  'Satwas & Kannod', 'Harda', 'Khategaon', 'Rehti',
];

export const TRACK_TOWNS = {
  'Harda':           ['Harda', 'Timarni', 'Seoni Malwa'],
  'Khategaon':       ['Khategaon', 'Nemawar', 'Sandalpur'],
  'Rehti':           ['Rehti', 'Gopalpur', 'Bherunda', 'Narmadapuram'],
  'Satwas & Kannod': ['Satwas', 'Kannod'],
};

// Town se Main Track mapping
export const TOWN_TO_MAIN_TRACK = {
  'Harda':           'Harda',
  'Timarni':         'Harda',
  'Seoni Malwa':     'Harda',
  'Khategaon':       'Khategaon',
  'Nemawar':         'Khategaon',
  'Sandalpur':       'Khategaon',
  'Rehti':           'Rehti',
  'Gopalpur':        'Rehti',
  'Bherunda':        'Rehti',
  'Narmadapuram':    'Rehti',
  'Satwas':          'Satwas & Kannod',
  'Kannod':          'Satwas & Kannod',
};

// 4 main tracks
export const MAIN_TRACKS = ['Harda', 'Khategaon', 'Rehti', 'Satwas & Kannod'];

export const STATUSES = ['Applied', 'Calling', 'Admitted', 'Waiting', 'Rejected', 'Disabled', 'Admission Cancel'];

export const STATUS_COLORS = {
  Applied: 'bg-gray-100 text-gray-800',
  Calling: 'bg-blue-100 text-blue-800',
  Admitted: 'bg-green-100 text-green-800',
  Waiting: 'bg-amber-100 text-amber-800',
  Rejected: 'bg-red-100 text-red-800',
  Disabled: 'bg-gray-200 text-gray-500',
  'Admission Cancel': 'bg-rose-100 text-rose-800 border border-rose-200',
};

export const ROLES = ['admin', 'manager', 'track_incharge', 'interviewer', 'receptionist'];
