import React from "react";

import { Link } from "react-router-dom";

const Footer: React.FC = () => {
  return (
    <footer className="footer mt-auto py-3 bg-light m">
      <div className="container d-flex justify-content-between">
        <span className="text-muted" id="left">
        VinInfo.cz - Kontrola vozidel zdarma | 
        Vyloučení odpovědnosti: Tento web je pouze informativní a neposkytuje žádnou formu poradenství. 
        Všechny informace jsou poskytovány bez záruky a s rizikem chybných údajů. 
        Tento web využívá partnerské (affiliate) odkazy – kliknutím na ně můžete podpořit náš provoz, aniž by se pro vás cokoliv měnilo.
        | Zdroj dat:{" "}
          <a
            href="https://www.dataovozidlech.cz/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Datová kostka
          </a>{" "}
          |{" "}
          <Link to="/podminky">
            Obchodní podmínky
          </Link>{" "}
          |{" "}
          <Link to="/ochrana-osobnich-udaju">
            Zásady ochrany osobních údajů a Cookies
          </Link>{" "}
          | © 2025 by{" "}
          <a href="https://fixweb.cz" target="_blank" rel="noopener noreferrer">
            FixWeb.cz
          </a>
        </span>
      </div>
    </footer>
  );
};

export default Footer;
