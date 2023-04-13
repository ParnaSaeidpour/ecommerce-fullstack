/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
 
  ],
  theme: {
    extend: {
      gridTemplateColumns:{
        fluid:"repeat(auto-fit, minmax(20rem,1fr))",
      }
    },
  },
  plugins: [require("daisyui")],


  daisyui: {
    themes: [ "coffee"],
},
}

