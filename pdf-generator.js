/* ════════════════════════════════════════════════════════════════
   pdf-generator.js — Génération PDF devis/factures (Artio)
   ──────────────────────────────────────────────────────────────
   Utilitaire partagé entre app.html, dossiers.html et rediger.html.

   API publique (sur window) :
     - window.ArtioPDF.generate(doc)         → save() direct (download)
     - window.ArtioPDF.toBlob(doc)           → retourne un Blob
     - window.ArtioPDF.toBase64(doc)         → retourne string base64 (sans préfixe data:)
     - window.ArtioPDF.toFilename(doc)       → "DEV-2026-001.pdf"

   Compat ascendante :
     - window.generatePDF(doc)               → save() direct
     - window.genererPDF(doc)                → alias historique

   Variable optionnelle : window.ARTIO_LOGO_WHITE (base64 PNG, sans préfixe)
   utilisée pour le filigrane bas de page. Si absente, ignoré silencieusement.

   Pré-requis : jsPDF 2.5.x + jspdf-autotable 3.5.x chargés AVANT ce fichier.
   ════════════════════════════════════════════════════════════════ */
(function(){
"use strict";

function _buildPDF(doc){
  const{jsPDF}=window.jspdf;
  const pdf=new jsPDF({unit:"mm",format:"a4"});
  const W=210,m=18,cW=W-2*m,rX=W-m;let y=m;

  // Format monétaire français : virgule décimale, séparateur de milliers espace insécable
  function fmtEur(n){
    const v=Number(n)||0;
    return v.toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2})+" \u20ac";
  }

  // ── En-tête : logo ou nom + couleur personnalisée ─────────────
  const pdfColor=doc.entreprise.couleur_pdf||"#378ADD";
  const rgb=(pdfColor.match(/[0-9a-f]{2}/gi)||["37","8a","dd"]).map(h=>parseInt(h,16));
  const LOGO_H=14;

  if(doc.entreprise.logo_base64){
    try{
      const props=pdf.getImageProperties(doc.entreprise.logo_base64);
      const ratio=props.width/props.height;
      const logoW=Math.min(LOGO_H*ratio,55);
      pdf.addImage(doc.entreprise.logo_base64,"PNG",m,y-2,logoW,LOGO_H);
      y+=LOGO_H+3;
    }catch(e){
      pdf.setFontSize(16).setFont(undefined,"bold").text(doc.entreprise.nom,m,y);
      y+=6;
    }
  }else{
    pdf.setFontSize(16).setFont(undefined,"bold").text(doc.entreprise.nom,m,y);
    y+=6;
  }
  pdf.setFontSize(9).setFont(undefined,"normal").text(doc.entreprise.adresse,m,y);y+=5;
  pdf.text("Tél : "+doc.entreprise.tel,m,y);y+=4;
  pdf.text("Email : "+doc.entreprise.email,m,y);y+=4;
  pdf.text("SIRET : "+doc.entreprise.siret,m,y);y+=4;
  if(doc.entreprise?.tva_intracom){pdf.text("TVA intracom. : "+doc.entreprise.tva_intracom,m,y);y+=4;}
  if(doc.entreprise?.iban){pdf.text("IBAN : "+doc.entreprise.iban,m,y);y+=4;}
  if(doc.entreprise?.rc_pro_assureur){
    pdf.text("RC Pro : "+doc.entreprise.rc_pro_assureur+(doc.entreprise.rc_pro_police?" — Pol. "+doc.entreprise.rc_pro_police:""),m,y);
    y+=4;
  }

  pdf.setFontSize(20).setFont(undefined,"bold").text(doc.type==="devis"?"DEVIS":"FACTURE",rX,m,{align:"right"});
  pdf.setFontSize(10).setFont(undefined,"normal");
  pdf.text("N° "+doc.docNumber,rX,m+9,{align:"right"});
  pdf.text("Date : "+doc.date,rX,m+15,{align:"right"});
  let yOff=21;
  if(doc.validUntil){pdf.text("Valable jusqu'au : "+doc.validUntil,rX,m+yOff,{align:"right"});yOff+=6;}
  if(doc.type==="facture"&&doc.devis_source_num){
    pdf.setFont(undefined,"italic").setTextColor(120)
      .text("Facture issue du devis "+doc.devis_source_num,rX,m+yOff,{align:"right"});
    pdf.setFont(undefined,"normal").setTextColor(0);
    yOff+=6;
  }
  if(doc.date_prestation){
    const dp=new Date(doc.date_prestation).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric"});
    const hp=doc.heure_prestation?" à "+doc.heure_prestation+(doc.heure_fin_prestation?" → "+doc.heure_fin_prestation:""):"";
    pdf.text((doc.type==="devis"?"Prestation prévue : ":"Prestation réalisée : ")+dp+hp,rX,m+yOff,{align:"right"});
  }

  y=58;
  pdf.setDrawColor(...rgb).setLineWidth(0.4).line(m,y,W-m,y);
  pdf.setLineWidth(0.2);y+=8;

  pdf.setFontSize(9).setFont(undefined,"bold").text("CLIENT",m,y);y+=5;
  pdf.setFont(undefined,"normal").text(doc.client.nom,m,y);y+=4;
  pdf.text(doc.client.adresse,m,y);y+=4;
  if(doc.client.tel){pdf.text("Tél : "+doc.client.tel,m,y);y+=4;}
  if(doc.client.is_professionnel&&doc.client.siret){pdf.text("SIRET : "+doc.client.siret,m,y);y+=4;}
  if(doc.client.is_professionnel&&doc.client.tva_intracom){pdf.text("TVA intracom. : "+doc.client.tva_intracom,m,y);y+=4;}
  y+=3;
  pdf.setFont(undefined,"bold").text("DESCRIPTION DE LA PRESTATION",m,y);y+=5;
  pdf.setFont(undefined,"normal");
  // Supprimer le Markdown généré par l'IA (titres #, gras **, listes -, etc.)
  function stripMd(s){
    return (s||"")
      .replace(/^#{1,6}\s+/gm,"")   // # titres
      .replace(/\*\*(.*?)\*\*/g,"$1") // **gras**
      .replace(/\*(.*?)\*/g,"$1")     // *italique*
      .replace(/^[-*]\s+/gm,"• ")    // listes
      .replace(/`([^`]+)`/g,"$1")    // `code`
      .trim();
  }
  const dl=pdf.splitTextToSize(stripMd(doc.description),cW);
  pdf.text(dl,m,y);y+=dl.length*4.5+6;

  const moRow=doc.nb_heures&&parseFloat(doc.nb_heures)>0
    ?["Temps de travail ("+doc.nb_heures+"h \u00d7 "+fmtEur(doc.entreprise.taux_horaire)+"/h)",doc.nb_heures,fmtEur(doc.entreprise.taux_horaire),fmtEur(doc.moHT)]
    :null;
  const tb=[
    ...(moRow?[moRow]:[]),
    ...(doc.pieces||[]).filter(p=>p.description&&p.quantite&&p.prix_unitaire).map(p=>[
      stripMd(p.description),
      p.quantite,
      fmtEur(p.prix_unitaire),
      fmtEur(parseFloat(p.quantite)*parseFloat(p.prix_unitaire))
    ])
  ];
  pdf.autoTable({
    startY:y,
    head:[["Description","Qté","Prix unit. HT","Total HT"]],
    body:tb,
    margin:{left:m,right:m},
    styles:{fontSize:9,cellPadding:3,overflow:"linebreak",valign:"top"},
    headStyles:{fillColor:rgb,textColor:255,fontStyle:"bold"},
    columnStyles:{0:{cellWidth:85,overflow:"linebreak"},1:{cellWidth:18,halign:"center"},2:{cellWidth:32,halign:"right"},3:{cellWidth:27,halign:"right"}}
  });
  y=pdf.lastAutoTable.finalY+6;

  pdf.setFontSize(9).setFont(undefined,"normal");
  pdf.text("Total HT :",135,y);pdf.text(fmtEur(doc.totalHT),rX,y,{align:"right"});y+=5;
  if(doc.entreprise.assujetti_tva){
    pdf.text("TVA ("+doc.tvaRate+"%) :",135,y);
    pdf.text(fmtEur(doc.tva),rX,y,{align:"right"});
    y+=5;
  }
  pdf.setFont(undefined,"bold").setFontSize(11)
    .text(doc.entreprise.assujetti_tva?"TOTAL TTC :":"TOTAL :",145,y);
  pdf.text(fmtEur(doc.ttc),rX,y,{align:"right"});y+=10;
  if(!doc.entreprise.assujetti_tva){
    pdf.setFont(undefined,"italic").setFontSize(8).setTextColor(100);
    pdf.text("TVA non applicable, art. 293 B du CGI",m,y);y+=5;
  }
  pdf.setFont(undefined,"normal").setFontSize(8).setTextColor(80);

  if(doc.type==="devis"){
    const condMap={
      "30_reception":"Paiement à réception de facture.",
      "30_jours":"Paiement à 30 jours date de facture.",
      "45_jours":"Paiement à 45 jours date de facture.",
      "60_jours":"Paiement à 60 jours date de facture.",
      "acompte_30":"30% d'acompte à la commande, solde à réception.",
      "acompte_50":"50% d'acompte à la commande, solde à réception.",
      "3_versements":"Règlement en 3 versements égaux.",
      "custom":"Voir conditions spécifiques.",
      "":"Paiement à réception de facture."
    };
    const condTxt=condMap[doc.entreprise.conditions_paiement||""]||"Paiement à réception de facture.";
    const validiteLabel=doc.validite_jours?doc.validite_jours+" jour"+(doc.validite_jours>1?"s":""):"";
    const validitePart=validiteLabel?(doc.validUntil?" Devis valable "+validiteLabel+", jusqu'au "+doc.validUntil+".":" Devis valable "+validiteLabel+"."):"";
    const fullCondTxt="Conditions : "+condTxt+validitePart;
    const condLines=pdf.splitTextToSize(fullCondTxt,cW);
    pdf.text(condLines,m,y);y+=condLines.length*4+2;
    y+=12;
    pdf.setTextColor(0).setFontSize(9).text("Bon pour accord — Date et signature :",m,y);y+=14;
    pdf.setDrawColor(180).line(m,y,m+80,y);
  }else{
    // Délai de paiement dynamique (depuis le profil, défaut 30 jours)
    const delai = doc.entreprise.delai_paiement || "30";
    const estPro = !!doc.client.is_professionnel;
    // Formulation légale : indemnité 40€ et taux majoré = obligation B2B (art. L441-10 C. com.).
    // En B2C, taux légal simple, pas d'indemnité forfaitaire automatique.
    const mentionPenalites = estPro
      ? "Paiement à "+delai+" jours. Aucun escompte n'est accordé pour paiement anticipé. En cas de retard de paiement, une pénalité de 3 fois le taux d'intérêt légal sera appliquée, à laquelle s'ajoutera une indemnité forfaitaire pour frais de recouvrement de 40 €."
      : "Paiement à "+delai+" jours. Aucun escompte n'est accordé pour paiement anticipé. En cas de retard de paiement, des pénalités au taux d'intérêt légal en vigueur seront appliquées.";
    const penLines = pdf.splitTextToSize(mentionPenalites, cW);
    pdf.text(penLines, m, y);
  }

  // Filigrane bas de page (optionnel)
  if(window.ARTIO_LOGO_WHITE){
    try{pdf.addImage("data:image/png;base64,"+window.ARTIO_LOGO_WHITE,"PNG",m,280,22,7);}catch(e){}
  }
  // Pied de page : nom, forme juridique, SIRET, SIREN, TVA intracom (mentions légales L441-9)
  const fjurid = doc.entreprise.forme_juridique ? " — " + doc.entreprise.forme_juridique : "";
  const siretStr = doc.entreprise.siret || "";
  const siren = siretStr.replace(/\s/g,"").slice(0,9);
  const line1 = doc.entreprise.nom + fjurid + " — SIRET : " + siretStr + (siren?" — SIREN : "+siren:"");
  pdf.setFontSize(7).setTextColor(150).text(line1, W/2, 284, {align:"center"});
  if(doc.entreprise.tva_intracom){
    pdf.text("TVA intracommunautaire : "+doc.entreprise.tva_intracom, W/2, 287, {align:"center"});
  }

  return pdf;
}

function toFilename(doc){
  if(doc&&doc.label){
    // Nettoyer le label pour nom de fichier : remplacer les caractères interdits
    const clean=doc.label.replace(/[/\\:*?"<>|]/g,"-").replace(/\s+/g,"_").slice(0,50);
    const num=doc.docNumber?doc.docNumber:"doc";
    return num+"_"+clean+".pdf";
  }
  return (doc&&doc.docNumber?doc.docNumber:"document")+".pdf";
}

function generate(doc){
  const pdf=_buildPDF(doc);
  pdf.save(toFilename(doc));
}

function toBlob(doc){
  const pdf=_buildPDF(doc);
  return pdf.output("blob");
}

function toBase64(doc){
  const pdf=_buildPDF(doc);
  // datauristring → "data:application/pdf;filename=generated.pdf;base64,XXXX"
  const dataUri=pdf.output("datauristring");
  const idx=dataUri.indexOf(",");
  return idx>=0?dataUri.slice(idx+1):dataUri;
}

window.ArtioPDF={generate,toBlob,toBase64,toFilename};

// ── Compat ascendante avec les anciens noms ───────────────────
if(typeof window.generatePDF!=="function") window.generatePDF=generate;
if(typeof window.genererPDF!=="function")  window.genererPDF=generate;

})();
