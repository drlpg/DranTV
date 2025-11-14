module.exports = {
  // Source files
  'src/**/*.{js,jsx,ts,tsx}': ['eslint --max-warnings=0', 'prettier -w'],

  // Scripts
  'scripts/**/*.{js,ts}': ['eslint --max-warnings=0', 'prettier -w'],

  // Root level files (excluding public directory)
  '*.{js,ts}': (filenames) => {
    const filtered = filenames.filter((file) => !file.startsWith('public/'));
    if (filtered.length === 0) return [];
    return [
      `eslint --max-warnings=0 ${filtered.join(' ')}`,
      `prettier -w ${filtered.join(' ')}`,
    ];
  },

  // Other files
  '**/*.{json,css,scss,md,webmanifest}': ['prettier -w'],
};
