const kullanicilar = [];

const odadakiBilenSayisi = {};

const kullaniciEkle = ({ id, isim, oda, oyuncuID, puan, odaKurucusu }) => {
  isim = isim;
  oda = oda;
  oyuncuID = oyuncuID;
  puan = puan;
  odaKurucusu = odaKurucusu;

  const index = kullanicilar.findIndex(
    kullanici => kullanici.oyuncuID === oyuncuID && kullanici.id !== id
  );
  if (index !== -1) {
    kullanicilar.splice(index, 1);
  }

  const kullanici = { id, isim, oda, oyuncuID, puan, odaKurucusu };

  if (!odadakiBilenSayisi.hasOwnProperty(oda)) {
    odadakiBilenSayisi[oda] = 0;
  }

  kullanicilar.push(kullanici);
  return { kullanici };
};

const kullaniciPuanEkle = (oda, oyuncuID, puan) => {
  const index = kullanicilar.findIndex(
    kullanici => kullanici.oyuncuID === oyuncuID && kullanici.oda === oda
  );
  if (index !== -1) {
    kullanicilar[index].puan += puan;
    console.log(`${oyuncuID} kullanicisina ${puan} puan eklendi`);
  }
};

const kullaniciSil = id => {
  const index = kullanicilar.findIndex(kullanici => kullanici.id === id);
  if (index !== -1) {
    return kullanicilar.splice(index, 1)[0];
  }
};

const kullaniciCek = id => kullanicilar.find(kullanici => kullanici.id === id);

const odadakiKullanicilar = oda =>
  kullanicilar.filter(kullanici => kullanici.oda === oda);

const oyunSiraListesi = oda => {
  return odadakiKullanicilar(oda).map(kullanici => kullanici.oyuncuID);
};

module.exports = {
  kullanicilar,
  kullaniciEkle,
  kullaniciSil,
  kullaniciCek,
  odadakiBilenSayisi,
  kullaniciPuanEkle,
  odadakiKullanicilar,
  oyunSiraListesi
};
