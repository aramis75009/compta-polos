import { describe, expect, it } from "vitest";
import {
  baseDeSignature,
  encoderRFC3986,
  enteteAuthorization,
  parserFormEncoded,
  signerHMAC,
  urlAutorisation,
} from "@/lib/trelloOAuth";

describe("urlAutorisation", () => {
  it("vise l'endpoint documenté avec le scope minimal", () => {
    const url = new URL(urlAutorisation("jeton-de-requete"));
    expect(url.origin + url.pathname).toBe("https://trello.com/1/OAuthAuthorizeToken");
    expect(url.searchParams.get("oauth_token")).toBe("jeton-de-requete");
    expect(url.searchParams.get("scope")).toBe("read,write");
    expect(url.searchParams.get("expiration")).toBe("never");
    expect(url.searchParams.get("name")).toBe("MyFlip");
  });

  it("ne demande jamais le scope account", () => {
    expect(urlAutorisation("x")).not.toContain("account");
  });
});

describe("encoderRFC3986", () => {
  // `encodeURIComponent` laisse passer ! ' ( ) * — la RFC 3986 les veut encodés.
  it("encode les caractères que encodeURIComponent laisse passer", () => {
    expect(encoderRFC3986("!'()*")).toBe("%21%27%28%29%2A");
  });

  it("laisse les caractères non réservés intacts", () => {
    expect(encoderRFC3986("aA0-._~")).toBe("aA0-._~");
  });

  it("encode l'espace en %20 et non en +", () => {
    expect(encoderRFC3986("a b")).toBe("a%20b");
  });
});

describe("baseDeSignature", () => {
  // RFC 5849 §3.4.1.1, exemple normatif.
  it("reproduit la base de signature de la RFC 5849", () => {
    const base = baseDeSignature("POST", "http://example.com/request", {
      b5: "=%3D",
      a3: "a",
      "c@": "",
      a2: "r b",
      oauth_consumer_key: "9djdj82h48djs9d2",
      oauth_token: "kkk9d7dh3k39sjv7",
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: "137131201",
      oauth_nonce: "7d8f3e4a",
    });
    expect(base).toBe(
      "POST&http%3A%2F%2Fexample.com%2Frequest&a2%3Dr%2520b%26a3%3Da%26b5%3D%253D%25253D" +
        "%26c%2540%3D%26oauth_consumer_key%3D9djdj82h48djs9d2%26oauth_nonce%3D7d8f3e4a" +
        "%26oauth_signature_method%3DHMAC-SHA1%26oauth_timestamp%3D137131201" +
        "%26oauth_token%3Dkkk9d7dh3k39sjv7",
    );
  });

  it("trie les paramètres par nom encodé", () => {
    const base = baseDeSignature("GET", "https://x.test/y", { b: "2", a: "1" });
    expect(base).toBe("GET&https%3A%2F%2Fx.test%2Fy&a%3D1%26b%3D2");
  });
});

describe("signerHMAC", () => {
  // Valeurs de référence calculées indépendamment de l'implémentation :
  //   node -e "console.log(require('crypto').createHmac('sha1','cs&ts').update('base').digest('base64'))"
  // La clé est « secretConsommateur&secretToken », les deux encodés RFC 3986.
  it("signe avec la clé composée des deux secrets", () => {
    expect(signerHMAC("base", "cs", "ts")).toBe("yokOBuNxfx9mDhT9jfD68gmZoT8=");
  });

  it("garde l'esperluette quand le secret de token est vide (étape request token)", () => {
    // HMAC-SHA1 de « base » avec la clé « cs& » — l'esperluette est présente
    // même sans second secret. L'omettre est l'erreur classique.
    expect(signerHMAC("base", "cs", "")).toBe("4LIHXsZ//boYzSP4VoU8yJSHkUE=");
  });

  it("produit une signature différente quand le secret change", () => {
    expect(signerHMAC("base", "cs", "autre")).toBe("4A3r85rLX+Oza72CMYuZ2bxpT0Y=");
    expect(signerHMAC("base", "cs", "autre")).not.toBe(signerHMAC("base", "cs", "ts"));
  });
});

describe("enteteAuthorization", () => {
  it("liste les paramètres oauth_* entre guillemets, séparés par des virgules", () => {
    const entete = enteteAuthorization(
      "POST",
      "https://trello.com/1/OAuthGetRequestToken",
      {
        oauth_consumer_key: "cle",
        oauth_nonce: "abc",
        oauth_signature_method: "HMAC-SHA1",
        oauth_timestamp: "1",
        oauth_version: "1.0",
        oauth_callback: "https://app.test/api/trello/callback",
      },
      "secret",
    );
    expect(entete).toMatch(/^OAuth /);
    expect(entete).toContain('oauth_consumer_key="cle"');
    expect(entete).toContain(
      'oauth_callback="https%3A%2F%2Fapp.test%2Fapi%2Ftrello%2Fcallback"',
    );
    expect(entete).toMatch(/oauth_signature="[^"]+"/);
  });

  it("n'inclut jamais le secret dans l'en-tête", () => {
    const entete = enteteAuthorization(
      "POST",
      "https://trello.com/1/OAuthGetRequestToken",
      {
        oauth_consumer_key: "cle",
        oauth_nonce: "abc",
        oauth_signature_method: "HMAC-SHA1",
        oauth_timestamp: "1",
        oauth_version: "1.0",
      },
      "SECRET-TRES-SECRET",
    );
    expect(entete).not.toContain("SECRET-TRES-SECRET");
  });
});

describe("parserFormEncoded", () => {
  it("lit la réponse de Trello", () => {
    expect(
      parserFormEncoded(
        "oauth_token=abc&oauth_token_secret=def&oauth_callback_confirmed=true",
      ),
    ).toEqual({
      oauth_token: "abc",
      oauth_token_secret: "def",
      oauth_callback_confirmed: "true",
    });
  });

  it("décode les valeurs percent-encodées", () => {
    expect(parserFormEncoded("a=x%20y")).toEqual({ a: "x y" });
  });

  it("renvoie un objet vide sur un corps vide", () => {
    expect(parserFormEncoded("")).toEqual({});
  });
});
