module.exports = {
  // Source files
  'src/**/*.{js,jsx,ts,tsx}': ['eslint --max-warnings=0', 'prettier -w'],

  // Scripts
  'scripts/**/*.{js,ts}': ['eslint --max-warnings=0', 'prettier -w'],

  // Root level config files (only prettier, no eslint)
  '.*.{js,ts}': ['prettier -w'],

  // Root level files (excluding public directory and dot files)
  '*.{js,ts}': (filenames) => {
    const path = require('path');
    const filtered = filenames.filter((file) => {
      const basename = path.basename(file);
      // 排除 public 目录和以点开头的文件
      return (
        !file.includes('public/') &&
        !file.includes('public\\') &&
        !basename.startsWith('.')
      );
    });
    if (filtered.length === 0) return [];
    return [
      `eslint --max-warnings=0 ${filtered.join(' ')}`,
      `prettier -w ${filtered.join(' ')}`,
    ];
  },

  // Other files
  '**/*.{json,css,scss,md,webmanifest}': ['prettier -w'],
};
