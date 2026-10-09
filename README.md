# Lyceum: Analiza Skupień k-means

Interaktywne kompendium i jednoekranowy traktat dydaktyczny (SaaS Light EdTech) poświęcony algorytmowi **k-means (k-średnich)** oraz analizie skupień w uczeniu maszynowym.

## Zawartość Traktatu (Ścieżka Dydaktyczna 5 Etapów)

1. **Intuicja Geometryczna i Diagramy Woronoja:**
   - Centroidy jako dynamiczne środki ciężkości.
   - Podział przestrzeni na wypukłe wielościany (komórki Woronoja) i dlaczego granice decyzyjne k-means są liniowe.
2. **Formalny Dowód Analityczny & Funkcja WCSS:**
   - Minimalizacja sumy kwadratów odległości wewnątrzklastrowych (WCSS / Inertia).
   - Krok po kroku: analityczne wyprowadzenie średniej arytmetycznej z zerowania gradientu funkcji celu.
   - Probabilistyczna inicjalizacja k-means++ z rozkładem \(D(x)^2\).
3. **Dotykowy Symulator Lloyda 2D (HTML5 Canvas):**
   - Interaktywne środowisko w 60 fps z rasteryzacją terytoriów Woronoja w czasie rzeczywistym.
   - Możliwość dodawania własnych punktów jednym kliknięciem myszki.
   - Presety danych: rozkłady Gaussa, szum oraz nieliniowe pierścienie (pokazujące ograniczenia k-means).
   - Przycisk kroku pojedynczego (przypisanie \(\to\) aktualizacja \(\to\) zbieżność) oraz autoodtwarzanie z wykresem spadku WCSS na żywo.
4. **Diagnostyka Jakości Skupień:**
   - Wykres Metody Łokcia (Elbow Method) z dynamicznym kursorem wybranego \(k\).
   - Analiza Sylwetki (Silhouette Score) dla oceny separacji klastrów.
   - Trzy pułapki praktyczne: brak standaryzacji, kształty niewypukłe, wrażliwość na outliery.
5. **Quiz Sprawdzający Zrozumienie:**
   - 4 pytania testujące mechanizmy matematyczne i zbieżność z natychmiastowym feedbackiem oraz punktacją na żywo.
6. **Produkcyjna Implementacja w Pythonie:**
   - Czysty wektorowy kod NumPy w 25 linijkach z obsługą k-means++ oraz odpowiednik scikit-learn.

## Standard Technologiczny

- **Zero-overhead single page stack:** HTML5, Tailwind CSS (CDN), KaTeX 0.16.8, Plotly 2.27.0.
- **Typografia:** Plus Jakarta Sans, JetBrains Mono, Newsreader.
- **Wymagania:** Działa natychmiast po otwarciu w dowolnej przeglądarce (`file://`) lub na GitHub Pages, bez procesu budowania (`npm`, `webpack`).

## Licencja

Otwarte zasoby edukacyjne Lyceum.
