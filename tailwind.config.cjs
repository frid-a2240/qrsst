// Genera public/css/admin.css (solo las clases que usa el panel admin): npm run build:css
module.exports = {
  content: ['./public/admin/*.html', './public/js/*.js'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff', 100: '#dbeafe', 500: '#00b4a8', 600: '#00a8a0',
          700: '#00857f', 800: '#1e40af', 900: '#1e3a8a'
        }
      },
      fontFamily: { sans: ['Montserrat', 'system-ui', 'sans-serif'] }
    }
  }
};
