import React from "react";
import { Link } from "react-router-dom";

const Footer: React.FC = () => {
  return (
    <footer className="footer mt-auto bg-light border-top">
      <div className="container py-4">
        <div className="row g-4">
          {/* Brand & Description */}
          <div className="col-12 col-md-6 col-lg-4">
            <h5 className="fw-bold mb-3" style={{ color: "#5a8f3e" }}>
              VIN Info.cz
            </h5>
            <p className="text-muted small mb-2">
              Kontrola vozidel zdarma podle VIN, TP nebo ORV.
            </p>
            <p className="text-muted small">
              Zdroj dat:{" "}
              <a
                href="https://www.dataovozidlech.cz/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-decoration-none"
              >
                Datová kostka
              </a><br />
              Kontakt: vininfo(zavináč)fixweb.cz
            </p>

          </div>

          {/* Quick Links */}
          <div className="col-6 col-md-3 col-lg-2">
            <h6 className="fw-bold mb-3">Navigace</h6>
            <ul className="list-unstyled mb-0">
              <li className="mb-2">
                <Link to="/" className="text-muted text-decoration-none small">
                  Vyhledávání
                </Link>
              </li>
              <li className="mb-2">
                <Link to="/klientska-zona" className="text-muted text-decoration-none small">
                  Moje VINInfo
                </Link>
              </li>
              <li className="mb-2">
                <Link to="/registrace" className="text-muted text-decoration-none small">
                  Registrace
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Links */}
          <div className="col-6 col-md-3 col-lg-2">
            <h6 className="fw-bold mb-3">Právní info</h6>
            <ul className="list-unstyled mb-0">
              <li className="mb-2">
                <Link to="/podminky" className="text-muted text-decoration-none small">
                  Obchodní podmínky
                </Link>
              </li>
              <li className="mb-2">
                <Link to="/ochrana-osobnich-udaju" className="text-muted text-decoration-none small">
                  Ochrana osobních údajů
                </Link>
              </li>
            </ul>
          </div>

          {/* Disclaimer */}
          <div className="col-12 col-lg-4">
            <h6 className="fw-bold mb-3">Upozornění</h6>
            <p className="text-muted small mb-0">
              Tento web je pouze informativní a neposkytuje žádnou formu poradenství.
              Informace jsou poskytovány bez záruky. Web využívá partnerské (affiliate)
              odkazy pro podporu provozu.
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <hr className="my-4" />
        <div className="row align-items-center">
          <div className="col-12 col-md-6 text-center text-md-start">
            <span className="text-muted small">
              © {new Date().getFullYear()} VIN Info.cz
            </span>
          </div>
          <div className="col-12 col-md-6 text-center text-md-end mt-2 mt-md-0">
            <span className="text-muted small">
              Vytvořil{" "}
              <a
                href="https://fixweb.cz"
                target="_blank"
                rel="noopener noreferrer"
                className="text-decoration-none"
              >
                FixWeb.cz
              </a>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
