const express = require("express");
const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server);
const router = require("./router");
const firebase = require("firebase");

// Firebasein kurulumu
const { firebaseConfig } = require("./firebaseConf.js");
firebase.initializeApp(firebaseConfig);
const soketRef = firebase.database().ref("oyunlar");

//Kullanici fonksiyonlari:
const {
  kullanicilar,
  kullaniciEkle,
  kullaniciSil,
  kullaniciPuanEkle,
  odadakiBilenSayisi,
  odadakiKullanicilar,
  oyunSiraListesi,
} = require("./kullanicilar.js");

const kelimeJson = require("./kelimeler.json");

const PORT = process.env.PORT || 5000;

io.on("connection", (socket) => {
  //console.log(`${socket.id} baglandi.`);
  //Client tarafindan oyun lobisine baglanma durumunda alinan bilgiler
  //Bu bilgiler soket tarafinda ve veritabanina yazim durumunlarinda kullanilir.

  socket.on("join", ({ isim, oda, oyuncuID, puan, odaKurucusu }, callback) => {
    const { error, kullanici } = kullaniciEkle({
      id: socket.id,
      isim,
      oda,
      oyuncuID,
      puan,
      odaKurucusu,
    });

    if (error) {
      console.log(error);
      return callback(error);
    }
    socket.join(oda);
    //Basit server bilgileri
    console.log(`\n\n`);
    console.log(`${socket.id} soket IDli oyuncu ---> ${oda} odasina baglandi `);

    //Kullanici baglanmasi durumunda oyun odasi verisine oyuncunun eklenmesi.
    setTimeout(function () {
      soketRef.once("value", (snapshot) => {
        if (snapshot.child(kullanici.oda).child("oyunKey").exists()) {
          soketRef
            .child(kullanici.oda)
            .child("oyuncuListesi")
            .child(kullanici.oyuncuID)
            .set({
              id: kullanici.oyuncuID,
              socketID: socket.id,
              isim: kullanici.isim,
              puan: kullanici.puan,
            });

          if (kullanici.odaKurucusu) {
            soketRef
              .child(kullanici.oda)
              .child("kurucuID")
              .set(kullanici.oyuncuID);
          }
        }
      });
    }, 1000);
    /**
     * Kurucu ve oyuncularin bulundugu odada kurucunun sayfasi yenilemesi sonrasi olusan
     * 2 kurucu bulunmasi sorununun cozumu.
     * Odaya giriste eger odada kurucu varsa giren kurucu bilgisinin degistirilmesi.
     **/
    if (kullanici.odaKurucusu) {
      odadakiKullanicilar(kullanici.oda).map((oyuncu) => {
        if (oyuncu.odaKurucusu && oyuncu.oyuncuID !== kullanici.oyuncuID) {
          kullanici.odaKurucusu = false;
        }
      });
    }
    //Kullanici bilgilerinin oyun arayuzune yollanmasi
    console.log(odadakiKullanicilar(kullanici.oda));
    io.to(kullanici.oda).emit("odaBilgisi", {
      oda: kullanici.oda,
      kullanicilar: odadakiKullanicilar(kullanici.oda),
    });
  });

  /**
   * Cizim verisinin yollanmasi:
   * Siradaki oyuncunun cizim yapmasi durumunda mouse koordinatlarinin alinmasi
   * Client uzerinden gelen mouse verisi cizen oyuncu haric diger oyunculara yollanir
   * Yollanan koordinat verileri diger oyuncularda p5 uzerinden tekrar cizime donusturulur.
   **/
  socket.on("mouse", ({ cizimData, odaData }) => {
    //console.log(cizimData);
    socket.broadcast.to(odaData).emit("mouseData", cizimData);
  });

  /*
   * Kurucunun oyunu baslatma durumu:
   * Kurucu oyuncunun oyun sayfasina yonlendirmesiyle baslatilir.
   * Secilen sure verisi servera gonderilir.
   * Gonderilen sure verisine gore timer baslatilir
   * Tum oyuncularin ayni sure verisine sahip olmasi beklenmektedir.
   */
  let oyunInterval;
  socket.on("timerBaslat", ({ oda, timerSure, oyunTuru, oyunDili }) => {
    /**
     * Oyun verilerinin tanimi:
     * Oyuncu Listesi,oyun sira numarasi,sira numarasina gore siradaki oyuncu
     * listedeki oyuncu sayisi ve sure burada tanimlanmistir.
     */
    let oyuncularListesi = odadakiKullanicilar(oda).map((kullanici) => {
      return kullanici.oyuncuID;
    });
    let oyunSirasi = 0;
    let siradakiOyuncu;
    let listeSayisi = oyuncularListesi.length - 1;
    let timerRef = timerSure;

    let kelimeData =
      kelimeJson[`kelimeler_${oyunDili === "Türkçe" ? "tr" : "eng"}`];
    let randomKelime;
    /**
     * ----Sure ve sira durumunun surekli kontrolu:----
     * Oyun suresi icerisinde oyundan ayrilan oyuncular olabilir
     * Bu kod blogu bu sira listesi ve oyun listesini her saniye basinda karsilastirir
     * Karsilastirma durumunda cikan oyuncu kontrol edilir
     * Cikan oyuncunun listedeki pozisyonuna gore liste verileri degistirilir
     * Degistirilen veriler tekrar oyunculara gonderilir.
     */
    oyunInterval = setInterval(function () {
      //console.log(`odadaki bilenler:${odadakiBilenSayisi[oda]}`);
      // oyuncularListesi = odadakiKullanicilar(oda).map((kullanici) => {
      //   return kullanici.oyuncuID;
      // });
      // listeSayisi = oyuncularListesi.length - 1;
      siradakiOyuncu = oyuncularListesi[oyunSirasi];
      // io.to(oda).emit("sonradanGirme", { randomKelime, siradakiOyuncu });
      if (oyuncularListesi.length === 1) {
        io.to(oda).emit("returnToAna");
        clearInterval(oyunInterval);
      }
      if (odadakiBilenSayisi[oda] === listeSayisi) {
        timerRef = 1;
        odadakiBilenSayisi[oda] = 0;
      }
      //Oyun intervalin oyuncu olmamasi durumunda durmasi.
      if (!siradakiOyuncu) {
        clearInterval(oyunInterval);
      }
      if (oyuncularListesi.length !== odadakiKullanicilar(oda).length) {
        let yeniOyuncularListesi = oyunSiraListesi(oda);
        oyuncularListesi.map((oyuncu) => {
          //Yeni listeden oyuncu eksilmis olmasi durumu;
          if (!yeniOyuncularListesi.includes(oyuncu)) {
            let indexOyuncu = oyuncularListesi.indexOf(oyuncu);
            //Eksilen oyuncu veya oyunculardan birisi siradaki oyuncu olmasi:
            if (oyuncu === siradakiOyuncu) {
              //Kontrol sirasinda kaybolan 1-2 saniyenin tamamlanmasi
              //Oyuncu degistiginde sure yine gonderilen sureye esit olacaktir
              timerRef = timerSure + 2;
              //Cikan siradaki oyuncunun listenin sonunda olmasi
              if (oyunSirasi > yeniOyuncularListesi.length - 1) {
                oyunSirasi = 0;
              }
            }
            //Cikan oyununun sirada olmamasi ancak siradaki oyuncudan once bir pozisyonda olmasi
            if (indexOyuncu < oyunSirasi) {
              oyunSirasi--;
            }
            //Cikan oyuncularin oyun sirasindan cikarilmasi
            oyuncularListesi.splice(indexOyuncu, 1);
            listeSayisi = oyuncularListesi.length - 1;
          }
        });
      }

      //Sunucu tarafinda siranin kontrol logu (GEREKLI DEGIL)
      // console.log(
      //   `Siradaki Oyuncu:${siradakiOyuncu}\nOyuncu Sira No:${oyunSirasi}\nOyuncular:${oyuncularListesi}\nTur:${oyunTuru}`
      // );
      //Sira degisimi sonrasinda cizim alaninin temizlenmesi
      //Rastgele kelimenin odaya gonderimi
      if (timerRef === timerSure) {
        randomKelime =
          kelimeData[Math.floor(Math.random() * kelimeData.length)];
        let indexKelime = kelimeData.indexOf(randomKelime);

        kelimeData.splice(indexKelime, 1);
        //Siranin oyun odasina gonderimi:
        io.to(oda).emit("siraDegistir", siradakiOyuncu);
        console.log(randomKelime);
        //console.log(kelimeData.kelimeler.length);
        io.to(oda).emit("kelimeDegis", randomKelime);
        io.to(oda).emit("cizimTemizle");
      }

      //Surenin oyun odasina gonderimi
      timerRef--;

      if (timerRef >= 0) io.to(oda).emit("timerDegistir", timerRef);

      //Normal isleyis durumunda sure bitimi,sira degisimi ve tur durumu:
      if (timerRef === 0) {
        io.to(oda).emit("kelimeyiGoster", true);
        setTimeout(function () {
          timerRef = timerSure;
          io.to(oda).emit("kelimeyiGoster", false);
        }, 5000);

        //Siranin tamamlanmasi durumunda tur sayisinin degisimi ve siranin bastan baslamasi:
        if (oyunSirasi === listeSayisi) {
          oyunSirasi = 0;
          oyunTuru--;
          io.to(oda).emit("odaTuru", oyunTuru);
          //Tum turlarin bitiminde oyunun bitmesi:
          //Oyunun puan listesi sayfasina yonlendirilmesi beklenir
          if (oyunTuru < 0) {
            setTimeout(function () {
              io.to(oda).emit("oyunBitti");
            }, 5000);
            console.log(`${oda} odasindaki oyun sonlandi.`);
            clearInterval(oyunInterval);
          }
        }
        //Normal isleyis durumunda siranin bir sonraki oyuncuya gecisi
        else {
          oyunSirasi++;
        }
      }
    }, 1200);
  });

  const kullaniciSoketBul = (gonderilenOyuncuID) => {
    let kullaniciSoketID;
    kullanicilar.map((kullanici) => {
      if (kullanici.oyuncuID === gonderilenOyuncuID)
        kullaniciSoketID = kullanici.id;
    });
    return kullaniciSoketID;
  };

  socket.on("kelimeBul", ({ oda, oyuncuID, OYUNCU_PUAN }) => {
    //console.log(`${oyuncuID} id li oyuncu ${kelime} kelimesini buldu.`);
    kullaniciPuanEkle(oda, oyuncuID, OYUNCU_PUAN);
    odadakiBilenSayisi[oda] += 1;
    //console.log(odadakiBilenSayisi[oda]);
    io.to(oda).emit("odaBilgisi", {
      oda: oda,
      kullanicilar: odadakiKullanicilar(oda),
    });
  });
  socket.on("cizenPuan", ({ oda, oyunSirasi, CIZEN_OYUNCU_PUAN }) => {
    kullaniciPuanEkle(oda, oyunSirasi, CIZEN_OYUNCU_PUAN);
    io.to(oda).emit("odaBilgisi", {
      oda: oda,
      kullanicilar: odadakiKullanicilar(oda),
    });
    io.to(kullaniciSoketBul(oyunSirasi)).emit("puanGirisi", CIZEN_OYUNCU_PUAN);
  });

  /**
   * Kullanicinin sayfadan cikis yapmasi durumu:
   * Soket ve veritabani uzerinden kullanicinin silinmesi
   **/

  socket.on("disconnect", () => {
    //Server kontrol logu
    console.log(`\n\n`);
    console.log(`${socket.id} ayrildi`);

    //Cikan kullanicinin verilerinin alinmasi
    const kullanici = kullaniciSil(socket.id);

    //Kullanicinin cikisi durumunda veritabani uzerinden silinmesi.
    //Oyuncu listesinde oyuncu kalmamasi durumunda oyun verisinin de silinmesi
    if (kullanici) {
      soketRef
        .child(kullanici.oda)
        .child("oyuncuListesi")
        .child(kullanici.oyuncuID)
        .remove();

      //Cikan kisinin oda kurucusu olma durumu
      //Kurucu yetkisi listeden siradaki oyuncuya verilebilir
      //ANCAK ODADA BIRILERI OLMALILDIR.
      //Sartlar saglandigi durumda veritabaninda da kurucu bilgisinin degismesi gerekir
      if (
        kullanici.odaKurucusu &&
        odadakiKullanicilar(kullanici.oda).length !== 0
      ) {
        let siradakiKullanici = odadakiKullanicilar(kullanici.oda)[0];
        siradakiKullanici.odaKurucusu = true;
        soketRef
          .child(siradakiKullanici.oda)
          .child("kurucuID")
          .set(siradakiKullanici.oyuncuID);
      }
      console.log(odadakiKullanicilar(kullanici.oda));
      //Kullanicinin ciktigi oyunda oyuncu kalmamasi durumunun
      //kontrol edilmesi ve duruma gore oyun verisinin silinmesi
      soketRef.on("value", (snapshot) => {
        if (!snapshot.child(kullanici.oda).child("oyuncuListesi").exists()) {
          //Oyun odasinin silinmesi:
          //Odada kimse olmamasi durumunda interval verisinin de durdurulmasi gerekmektedir
          soketRef.child(kullanici.oda).remove();
        }
      });

      //Odada bulunan kullanicilarin bilgilerinin guncellenmesi.
      io.to(kullanici.oda).emit("odaBilgisi", {
        oda: kullanici.oda,
        kullanicilar: odadakiKullanicilar(kullanici.oda),
      });
    }
  });
});

app.use(router);
server.listen(PORT, () => {
  console.log(`\nSunucu ${PORT} portunda baslatildi.\n`);
});
