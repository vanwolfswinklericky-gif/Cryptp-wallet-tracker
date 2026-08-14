/* Extra small screens for responsive tab labels */
@layer utilities {
  .xs\:inline {
    @media (min-width: 480px) {
      display: inline;
    }
  }
  .xs\:hidden {
    @media (max-width: 479px) {
      display: none;
    }
  }
}