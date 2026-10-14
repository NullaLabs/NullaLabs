(function initNullaPlainTutorial(root) {
  'use strict';
  const ids=["evidence","element","chemistry","thermal","nuclear","measurement","verification"];
  const text={
  "es": [
    "Mira tres cosas distintas: un dato viene de una fuente; un modelo aplica reglas; una ilustración nos ayuda a imaginar.",
    "Elige un elemento. Z cuenta sus protones. La fórmula dice qué tipos de átomos hay, no cómo fabricar la sustancia.",
    "Combinar usa ejemplos revisados en el catálogo. Mezclar sólo junta sustancias: no inventa enlaces ni productos.",
    "Cambia la temperatura. La fase sólo se muestra cuando hay datos. El movimiento de las partículas es una ilustración, no una predicción exacta.",
    "Elige una reacción nuclear. A cuenta protones y neutrones juntos; Z cuenta protones. Ambos deben conservarse. Q positiva no dice qué tan fácil o rápido ocurre.",
    "Elige dos átomos para medir la distancia, o tres para medir un ángulo. Las unidades reales sólo aparecen si la escala está calibrada.",
    "Antes de concluir, revisa de dónde vienen los datos, qué falta y qué no puede calcular este modelo. Después intenta repetir la experiencia."
  ],
  "en": [
    "Three things are different: data comes from a source, a model follows rules, and an illustration helps us imagine.",
    "Choose an element. Z counts its protons. A formula says which kinds of atoms are present, not how to manufacture the substance.",
    "Combine uses examples checked in the catalogue. Mix only puts species together; it does not invent bonds or products.",
    "Change the temperature. A phase appears only when data is available. Moving particles are an illustration, not an exact prediction.",
    "Choose a nuclear reaction. A counts protons and neutrons together; Z counts protons. Both are conserved. Positive Q does not tell you how easy or fast it is.",
    "Choose two atoms to measure distance, or three to measure an angle. Real-world units appear only when the scale is calibrated.",
    "Before concluding, check where the data came from, what is missing, and what the model cannot calculate. Then try to repeat the experiment."
  ],
  "ja": [
    "3つを区別しましょう。データは情報源から来て、モデルは規則に従い、図解は想像を助けます。",
    "元素を選びます。Zは陽子の数です。化学式はどんな原子があるかを示しますが、製造方法ではありません。",
    "「結合」はカタログで確認された例だけを使います。「混合」は物質を一緒に置くだけで、結合や生成物を作りません。",
    "温度を変えましょう。相はデータがある場合だけ表示します。粒子の動きは学習用の図解で、正確な予測ではありません。",
    "核反応を選びます。Aは陽子と中性子の合計、Zは陽子の数です。どちらも保存されます。Qが正でも反応の起こりやすさや速さは分かりません。",
    "距離には原子を2つ、角度には3つ選びます。実際の単位は尺度が校正されている場合だけ表示します。",
    "結論の前に、データの出所、不足情報、モデルで計算できないことを確認します。その後、同じ実験を再現してみましょう。"
  ],
  "ru": [
    "Различайте три вещи: данные приходят из источника, модель следует правилам, а иллюстрация помогает представить идею.",
    "Выберите элемент. Z считает протоны. Формула показывает атомы в составе, но не способ изготовления вещества.",
    "«Соединить» использует только проверенные записи каталога. «Смешать» лишь помещает вещества вместе и не придумывает связи или продукты.",
    "Измените температуру. Фаза показывается только при наличии данных. Движение частиц — учебная иллюстрация, а не точный прогноз.",
    "Выберите ядерную реакцию. A — число протонов и нейтронов вместе, Z — число протонов. Оба сохраняются. Положительное Q не показывает вероятность или скорость.",
    "Выберите два атома для расстояния или три для угла. Реальные единицы появляются только при калиброванном масштабе.",
    "Прежде чем делать вывод, проверьте источник данных, недостающую информацию и ограничения модели. Затем попробуйте повторить опыт."
  ],
  "zh": [
    "先分清三件事：数据来自来源，模型按规则计算，示意图帮助我们想象。",
    "选择一种元素。Z表示质子数。化学式告诉你有哪些原子，不代表制造这种物质的方法。",
    "“组合”只使用目录中已核对的例子。“混合”只是把物质放在一起，不会虚构化学键或产物。",
    "改变温度。只有存在数据时才显示物态。粒子运动是学习示意，不是精确预测。",
    "选择核反应。A是质子与中子的总数，Z是质子数；两者都必须守恒。Q为正不代表反应容易发生或速度很快。",
    "选择两个原子测距离，或三个原子测角度。只有经过校准的尺度才会显示真实单位。",
    "下结论前，检查数据来源、缺失的信息，以及模型不能计算什么。然后尝试重复这个实验。"
  ],
  "fr": [
    "Distinguez trois choses : une donnée vient d'une source, un modèle suit des règles et une illustration aide à imaginer.",
    "Choisissez un élément. Z compte ses protons. Une formule indique les types d'atomes présents, pas comment fabriquer la substance.",
    "COMBINER utilise seulement les exemples vérifiés du catalogue. MÉLANGER réunit des espèces sans inventer de liaisons ni de produits.",
    "Changez la température. La phase n'est affichée que si des données existent. Le mouvement des particules est une illustration, pas une prédiction exacte.",
    "Choisissez une réaction nucléaire. A compte protons et neutrons; Z compte les protons. Les deux se conservent. Un Q positif ne donne ni la probabilité ni la vitesse.",
    "Choisissez deux atomes pour une distance ou trois pour un angle. Les unités réelles ne s'affichent que si l'échelle est calibrée.",
    "Avant de conclure, vérifiez la source des données, ce qui manque et ce que le modèle ne peut pas calculer. Essayez ensuite de refaire l'expérience."
  ],
  "it": [
    "Distingui tre cose: un dato viene da una fonte, un modello segue regole e un'illustrazione aiuta a immaginare.",
    "Scegli un elemento. Z conta i protoni. La formula dice quali tipi di atomi sono presenti, non come fabbricare la sostanza.",
    "COMBINARE usa solo esempi verificati nel catalogo. MESCOLARE mette insieme le specie senza inventare legami o prodotti.",
    "Cambia la temperatura. La fase appare solo se ci sono dati. Il movimento delle particelle è un'illustrazione, non una previsione esatta.",
    "Scegli una reazione nucleare. A conta protoni e neutroni insieme; Z conta i protoni. Entrambi si conservano. Q positivo non indica probabilità o velocità.",
    "Scegli due atomi per misurare una distanza o tre per un angolo. Le unità reali appaiono solo con una scala calibrata.",
    "Prima di concludere, controlla la fonte dei dati, cosa manca e cosa il modello non può calcolare. Poi prova a ripetere l'esperimento."
  ],
  "de": [
    "Unterscheide drei Dinge: Daten stammen aus einer Quelle, ein Modell folgt Regeln, und eine Illustration hilft beim Vorstellen.",
    "Wähle ein Element. Z zählt seine Protonen. Eine Formel zeigt, welche Atome enthalten sind, nicht wie der Stoff hergestellt wird.",
    "KOMBINIEREN nutzt nur geprüfte Beispiele aus dem Katalog. MISCHEN stellt Stoffe zusammen, ohne Bindungen oder Produkte zu erfinden.",
    "Ändere die Temperatur. Eine Phase wird nur bei verfügbaren Daten angezeigt. Die Teilchenbewegung ist eine Illustration, keine genaue Vorhersage.",
    "Wähle eine Kernreaktion. A zählt Protonen und Neutronen; Z zählt Protonen. Beide bleiben erhalten. Ein positives Q verrät weder Wahrscheinlichkeit noch Geschwindigkeit.",
    "Wähle zwei Atome für einen Abstand oder drei für einen Winkel. Reale Einheiten erscheinen nur bei kalibrierter Skala.",
    "Prüfe vor einer Schlussfolgerung die Datenquelle, fehlende Angaben und die Grenzen des Modells. Versuche dann, das Experiment zu wiederholen."
  ],
  "pt": [
    "Distinga três coisas: um dado vem de uma fonte, um modelo segue regras e uma ilustração ajuda a imaginar.",
    "Escolha um elemento. Z conta seus prótons. A fórmula mostra quais átomos existem, não como fabricar a substância.",
    "COMBINAR usa apenas exemplos verificados no catálogo. MISTURAR apenas reúne espécies; não inventa ligações nem produtos.",
    "Mude a temperatura. A fase só aparece quando há dados. O movimento das partículas é uma ilustração, não uma previsão exata.",
    "Escolha uma reação nuclear. A conta prótons e nêutrons juntos; Z conta prótons. Ambos se conservam. Q positivo não informa probabilidade ou velocidade.",
    "Escolha dois átomos para medir a distância ou três para um ângulo. Unidades reais só aparecem com escala calibrada.",
    "Antes de concluir, verifique a origem dos dados, o que falta e o que o modelo não calcula. Depois tente repetir a experiência."
  ],
  "ko": [
    "세 가지를 구분하세요. 데이터는 출처에서 오고, 모델은 규칙을 따르며, 도해는 상상을 돕습니다.",
    "원소를 선택하세요. Z는 양성자 수입니다. 화학식은 어떤 원자가 있는지 보여 주지만 제조 방법을 뜻하지는 않습니다.",
    "결합은 목록에서 확인된 사례만 사용합니다. 혼합은 물질을 함께 놓을 뿐, 결합이나 생성물을 만들어 내지 않습니다.",
    "온도를 바꿔 보세요. 데이터가 있을 때만 상태를 표시합니다. 입자의 움직임은 학습용 도해이며 정확한 예측이 아닙니다.",
    "핵반응을 선택하세요. A는 양성자와 중성자의 합, Z는 양성자 수입니다. 둘 다 보존됩니다. Q가 양수여도 반응 확률이나 속도를 뜻하지 않습니다.",
    "거리에는 원자 두 개, 각도에는 세 개를 선택하세요. 실제 단위는 보정된 척도에서만 표시됩니다.",
    "결론을 내리기 전에 데이터 출처, 빠진 정보, 모델이 계산할 수 없는 것을 확인하세요. 그런 다음 실험을 반복해 보세요."
  ],
  "ar": [
    "ميّز بين ثلاثة أشياء: البيانات تأتي من مصدر، والنموذج يتبع قواعد، والرسم التوضيحي يساعدنا على التخيل.",
    "اختر عنصراً. يَعدّ Z البروتونات. تخبرك الصيغة بأنواع الذرات الموجودة، لا بطريقة تصنيع المادة.",
    "يستخدم الدمج أمثلة جرى التحقق منها في الفهرس فقط. أما الخلط فيجمع الأنواع دون اختراع روابط أو نواتج.",
    "غيّر درجة الحرارة. لا تظهر الحالة إلا عند توفر البيانات. حركة الجسيمات رسم تعليمي وليست تنبؤاً دقيقاً.",
    "اختر تفاعلاً نووياً. يمثّل A مجموع البروتونات والنيوترونات، ويمثّل Z عدد البروتونات؛ ويجب حفظهما. قيمة Q الموجبة لا تحدد احتمال التفاعل أو سرعته.",
    "اختر ذرتين لقياس المسافة أو ثلاثاً لقياس زاوية. لا تظهر الوحدات الواقعية إلا عندما يكون المقياس معايراً.",
    "قبل الاستنتاج، راجع مصدر البيانات وما ينقص وما لا يستطيع النموذج حسابه. ثم حاول تكرار التجربة."
  ]
};
  const labels={
  "es": "Ver explicación científica",
  "en": "Open the scientific explanation",
  "ja": "科学的な説明を表示",
  "ru": "Показать научное объяснение",
  "zh": "查看科学解释",
  "fr": "Voir l’explication scientifique",
  "it": "Mostra la spiegazione scientifica",
  "de": "Wissenschaftliche Erklärung öffnen",
  "pt": "Ver explicação científica",
  "ko": "과학적 설명 보기",
  "ar": "عرض التفسير العلمي"
};
  function get(locale='es',stepId) { const lang=Object.prototype.hasOwnProperty.call(text,locale)?locale:'es'; const index=ids.indexOf(stepId); if(index<0)return null; return {stepId,text:text[lang][index],technicalLabel:labels[lang]||labels.es}; }
  root.NULLA_TUTORIAL_PLAIN={get,locales:Object.keys(text),stepIds:ids.slice()};
})(typeof window!=='undefined'?window:globalThis);
