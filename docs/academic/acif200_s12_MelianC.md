












## ACIF200
## SEMINARIO DE LICENCIATURA EN
## INGENIERÍA
## AVANCE DEL PROYECTO
## FASE 3

Nombre integrante/s: Cristian Melián Ferrada
## Curso: 2410
## Fecha: 08/09/2026










## 2



## APARTADOS
## I. Portada Institucional
II. Índice
III. Resumen ejecutivo
IV. Introducción a la problemática.
V. Definición y fundamentación de la problemática.
VI. Relevancia e impacto del problema
VII. Objetivo general y objetivos específicos
VIII. Alcances y limitaciones
IX. Fundamentación teórica
X. Marco teórico y conceptual
XI. Marco metodológico
XII. Planificación y cronograma
XIII. Conclusiones generales
XIV. Bibliografía
XV. Anexos


## 3


## UNIVERSIDAD ANDRÉS BELLO
Facultad de Ingeniería
## Ingeniería Civil Informática Advance





## SISTEMA MÓVIL DE SOPORTE INTELIGENTE PARA LA
## INTERPRETACIÓN DE ENSAYOS EN MICROBIOLOGÍA CLÍNICA
Informe de Avance, Fase 3






Seminario de Licenciatura en Ingeniería (ACIF200)



## Autor: Cristian Mauricio Melián Ferrada
Profesor guía: Diego Robles Cruz





## Santiago, Chile
Septiembre de 2026






## 4


II. Índice

III. Resumen ejecutivo .......................................................................................................................... 5
IV. Introducción a la problemática ....................................................................................................... 5
V. Definición y fundamentación de la problemática .......................................................................... 7
VI. Relevancia e impacto del problema.............................................................................................. 11
VII. Objetivo general y objetivos específicos ..................................................................................... 15
VIII. Alcances y limitaciones ................................................................................................................. 16
IX. Fundamentación teórica ................................................................................................................ 18
X. Marco teórico y conceptual ........................................................................................................... 19
XII. Planificación y cronograma .......................................................................................................... 30
XIII. Conclusiones generales ................................................................................................................ 32
XIV. Bibliografía ..................................................................................................................................... 33
XV. Anexos ............................................................................................................................................ 36
Anexo 1: Diagrama Conceptual del Marco Teórico ...................................................................................................... 36
Anexo 2: Flujo de Fases Metodológicas ....................................................................................................................... 37
Anexo 3: Secuencia Funcional y Arquitectura .............................................................................................................. 38
Anexo 4: Algoritmos de Entrenamiento y Optimización en Borde. Fuente: elaboración propia, 2026. ...................... 39



## 5


III. Resumen ejecutivo

El análisis convencional de ensayos de susceptibilidad antimicrobiana por difusión en disco (Kirby-Bauer) en
laboratorios de recursos limitados depende de la inspección visual analógica, generando variabilidad inter-
operador  y  demoras  operativas  propias  de la  interpretación  humana.  Este  proyecto  tiene  como  objetivo
general  desarrollar  un  sistema  de  software  móvil  interoperable  que  provea  apoyo  inteligente  para  la
interpretación  visual  de  placas  microbiológicas,  con  el  fin  de  estandarizar  los  análisis  analíticos  en
laboratorios clínicos.

Metodológicamente,  se  adopta  un  diseño  de  desarrollo  experimental  e  incremental  que  articula:  (1)
preprocesamiento  óptico  determinista  con  visión  computacional  (OpenCV)  para  compensar  distorsiones
cromáticas  y  proyectivas; (2)  inferencia  en  el  borde  (Edge AI)  mediante redes  convolucionales compactas
cuantizadas a INT8 para dispositivos móviles; (3) interpretabilidad visual mediante mapas de activación Grad-
CAM  bajo  el  paradigma  human-in-the-loop,  salvaguardando  la  supervisión  del  tecnólogo  médico;  y  (4)  un
middleware   de   integración   diagnóstica   basado   en   el   estándar   HL7   FHIR   (recursos Observation y
DiagnosticReport con  terminologías  LOINC  y  SNOMED  CT)  para  interoperabilidad  con  Sistemas  de
Información de Laboratorio (LIS).

Los resultados esperados proyectan reducir la dispersión de error métrico en la delimitación de halos a niveles
submilimétricos  (<0.5  mm),  disminuir  el  tiempo  de  lectura  a  menos  de  un  segundo  por  muestra  sin
dependencia de servidores en la nube y asegurar la privacidad de datos conforme a la Ley N° 21.719. Esta
propuesta  aporta  valor  disciplinar  al  consolidar  una  solución  de  inteligencia  artificial  móvil,  reproducible,
auditable y de bajo costo para la salud pública.
IV. Introducción a la problemática

El laboratorio de microbiología clínica representa un pilar fundamental dentro del ecosistema de salud, siendo
el  responsable  directo  del  aislamiento,    recuperación  e  identificación  de  patógenos  para  guiar  la  terapia
antibiótica  del  paciente.  Este  entorno operativo  se  caracteriza por  una  cadena  de  procesos  altamente
jerárquica y secuencial que abarca desde la recepción de la muestra hasta el reporte final en el Sistema de
Información del Laboratorio (LIS). A pesar de los avances generales en medicina, el núcleo de la actividad
diagnóstica  en  el  área  de  microbiología  continúa  estando  dominado  por  metodologías  tradicionales
cualitativas o semicuantitativas fuertemente dependientes del operador.

Actualmente,    los  profesionales  del  laboratorio — específicamente  los  tecnólogos  médicos  en  el  contexto
nacional — deben realizar inspecciones visuales manuales de placas de cultivo para determinar la presencia
o ausencia de desarrollo bacteriano, así como realizar mediciones físicas y directas de los halos de inhibición
en las pruebas de susceptibilidad antimicrobiana  (AST). La gestión de este volumen masivo de muestras
obliga  a  personal  altamente  calificado  a  consumir  valiosas  horas-hombre  en  tareas  repetitivas  de  revisión
visual  y  digitación  manual  de  resultados  uno  a  uno  en  el  LIS,  sobrecargando  los  flujos  de  trabajo.  Esta
ineficiencia  sistémica  se  ve  gravemente  agudizada  por  antecedentes  empíricos  globales  que  documentan
una dificultad estructural para encontrar personal calificado en esta área del laboratorio clínico, lo que eleva
drásticamente el riesgo de fatiga y la variabilidad subjetiva del operador en tareas críticas de diagnóstico, un
escenario  adverso  que  se  complejiza  ante  la  evidente  reducción  de  la  fuerza  laboral  calificada  en  los
laboratorios clínicos contemporáneos (Graf et al., 2025; Kirn, 2016).

## 6



Desde la perspectiva de la Ingeniería Civil Informática, la persistencia de estos flujos manuales plantea un
desafío ingenieril complejo. No se trata simplemente de un problema administrativo, sino de una brecha en
la digitalización y automatización de procesos biológicos. El reto disciplinar radica en transmutar flujos físicos
analógicos en un ecosistema digital gobernado por la computación en el borde (Edge AI) y la interoperabilidad
de  datos  en  salud.  Esto  exige  resolver  problemas  sofisticados  de  visión  computacional —como  el
procesamiento de imágenes bajo condiciones ópticas hostiles en el mesón de trabajo— en paralelo con el
diseño de componentes de software intermedios (middleware) capaces de estructurar, codificar y transmitir
datos biomédicos de forma síncrona o asíncrona hacia sistemas hospitalarios tradicionales.

La pertinencia académica  y profesional   de abordar esta problemática es inmediata, conectándose
directamente con las discusiones contemporáneas sobre la transformación digital y la Inteligencia Artificial
aplicada a la salud pública. Consensos globales de la disciplina, reflejados en los reportes de la European
Society  of Clinical Microbiology and Infectious Diseases (Greutmann  et  al.,  2025), determinan que los
modelos de visión  artificial  estructurados sobre Redes  Neuronales  Convolucionales    (CNN)    exhiben    una
promesa excepcional para optimizar los procesos tecnológicos del laboratorio. Sin embargo, a nivel local en
Chile, la automatización actual está estancada: concentrada en plataformas comerciales que operan como
sistemas cerrados y difíciles de implementar para laboratorios medianos y regionales,  sumado a un vacío
absoluto en la literatura científica nacional indexada sobre arquitecturas portátiles de código abierto.

Sobre la base de las deficiencias operativas detectadas en el entorno clínico y los estándares de resolución
provistos por la ingeniería informática, se formula el desafío central de este proyecto a través de la siguiente
interrogante:

¿Cómo  estandarizar  y  automatizar  la  interpretación  de  imágenes  de  ensayos  microbiológicos  mediante
Inteligencia Artificial móvil e interoperable, como soporte analítico en el laboratorio clínico?

Frente  a  esto,  el  proyecto  se funda sobre  un  principio  ético  estricto:  la  tecnología  no busca reemplazar al
profesional, sino potenciar su capacidad. En lugar de actuar como un sistema autónomo ciego, la solución
móvil se diseña bajo un paradigma cooperativo Human-in-the-loop (el humano en el ciclo). Al enfocar una
placa de cultivo con la cámara del dispositivo móvil, el software procesa la imagen en tiempo real y despliega
directamente en pantalla una propuesta de interpretación sugerida —ya sea el descarte automatizado de un
cultivo  negativo,  el  recuento  de  colonias  o  la  medición  de  halos  de  susceptibilidad—.  Esta  sugerencia  se
complementa  con  la  proyección  superpuesta  de  mapas  de  calor generados  por  la  IA  explicativa    (XAI),
otorgando total transparencia al proceso analítico. Esto permite que el profesional valide, confirme o corrija
visualmente  la  lectura  en  un  dispositivo  móvil con  un  solo  toque,  gatillando  la  transmisión  inmediata  y
automatizada del resultado hacia el LIS institucional.

Por consiguiente, este proyecto se adscribe de manera directa al ámbito de acción de Inteligencia Artificial,
articulándose  estrechamente  como  un  motor  de  Transformación  Digital  en  salud.  Para  dar  respuesta  al
desafío planteado, este informe se estructura en tres grandes etapas: inicialmente, se establecerá el marco
metodológico  de  los  modelos  de  Deep  Learning  y  las  técnicas  de  explicabilidad  (XAI)  para  el  análisis  de
imágenes biológicas utilizando repositorios abiertos; posteriormente, se detallará el diseño arquitectónico de
la solución, especificando el pipeline de visión artificial en el dispositivo  móvil  (Edge  AI)  y  la  lógica  del
middleware desacoplado para la interpretación de reglas de negocio de mesón; y finalmente, se evaluará el

## 7


rendimiento  técnico  del  sistema  mediante  métricas  de  sensibilidad  matemática  e  interoperabilidad  bajo  el
estándar  HL7  FHIR  y  la  norma  ISO  15189, demostrando  la  viabilidad  ingenieril  y  el  impacto  real  de  este
copiloto inteligente.
V. Definición y fundamentación de la problemática

El  flujo  operativo  en  un  laboratorio  de  microbiología  clínica  se  rige  por  procesos  analíticos  estrictamente
secuenciales.  Tras  la  recepción  y  siembra  de  las  muestras  biológicas,  las  placas  de  agar  se  someten  a
periodos  de  incubación  que  oscilan  entre  las  24  y  las  48  horas.  Cumplido  este  tiempo,  se  inicia  la  fase
analítica crítica, donde intervienen los principales actores del sistema: el tecnólogo médico y el Sistema de
Información del Laboratorio (LIS).

En  el  paradigma  productivo  actual,  el  profesional  debe  extraer  manualmente  cada  placa  del  incubador  y
realizar una inspección visual directa frente a una fuente de luz para ejecutar tres procesos esenciales:

- Tamizaje  analítico  (Screening):  Clasificar  visualmente  las  placas  en  cultivos  negativos  (sin  desarrollo
microbiológico) o positivos.
- Recuento  microbiológico:  Cuantificar  de  forma  manual,  cuando  el  examen  lo  requiere,  las  unidades
formadoras de colonias (UFC) presentes en cultivos positivos.
- Pruebas  de  susceptibilidad  antimicrobiana  (AST):  Medir  con  un  calibre  físico  o  una  regla  milimétrica  el
diámetro de los halos de inhibición formados alrededor de los discos de antibiótico en placas de difusión
en agar (antibiogramas).

Una vez realizada esta interpretación analógica, el tecnólogo médico se desplaza a una terminal informática
fija para transcribir manualmente cada métrica e interpretación clínica en el LIS. En Chile, este entorno se
enfrenta a una severa brecha de digitalización en el punto de atención. Mientras que áreas como la química
clínica o la hematología operan bajo una automatización e interoperabilidad casi absoluta, la microbiología
de mesón se mantiene como una "isla tecnológica" analógica. La automatización avanzada en esta disciplina
está  monopolizada  por  plataformas  comerciales  cerradas  de  alto  volumen, cuyas  barreras  de  costo  de
adquisición,  licenciamiento  y  rigidez  de  infraestructura  las  vuelven  completamente  inviables  para  los
laboratorios clínicos de mediana complejidad y centros de salud regionales del país.

La  persistencia  de  estos  flujos  manuales  en  entornos  asistenciales  de  alta  demanda  diagnóstica  genera
ineficiencias sistémicas cuantificables y riesgos documentados en la literatura científica contemporánea:

- Carga   Operativa   por   Cultivos   Negativos: Los   análisis   de   optimización   en   flujos   operacionales
microbiológicos  demuestran  que  la  inmensa  mayoría  de  la  carga  de  trabajo  diaria  en  programas  de
tamizaje masivo corresponde a muestras completamente negativas o sin desarrollo biológico de interés.
Evaluaciones clínicas multicéntricas de gran escala evidencian que entre el 84% y el 88.6% del volumen
total  de  especímenes  procesados  resultan  negativos  en  el  screening (Faron  et  al.,  2016).  Obligar  a
profesionales  altamente  calificados  a  revisar  visualmente  y  transcribir  de  forma  individual  este  enorme
porcentaje de placas limpias representa una ineficiencia crítica y un elevado costo en horas-hombre, lo
que justifica técnicamente la transición hacia pipelines de visión computacional capaces de automatizar el
descarte en lote de placas sin crecimiento biológico.
- Variabilidad Inter-operador y Fatiga Cognitiva: La medición manual de halos de inhibición y el recuento

## 8


visual  de  colonias  aglomeradas  están  sujetos  a  una  alta  variabilidad  subjetiva.  La  fatiga  acumulada
durante jornadas extensas degrada la reproducibilidad de las lecturas analógicas. Según datos provistos
por  Ciftci  et  al.  (2026),  el  uso  de  sistemas automáticos  basados  en  visión  artificial  alcanza  un  Acuerdo
Categórico (CA) del 94.2% y reduce las tasas de Error Muy Mayor (VME) al 1.2%, evidenciando la brecha
de  exactitud  y  precisión  que  sufren  los  métodos  manuales  frente  a  los  estándares  algorítmicos
contemporáneos.
- Déficit  de  Especialistas  y  Seguridad  del  Paciente: La  escasez  global  y  local  de  tecnólogos  médicos
especializados en microbiología clínica tensiona severamente los flujos de trabajo en salud, una realidad
impulsada por la constante contracción de la fuerza laboral técnica disponible en esta área (Kirn, 2016).
Graf et al. (2025) exponen que la integración de herramientas de inteligencia artificial en la microbiología
digital  es  una herramienta  clave no  solo  para  mejorar  la  exactitud  diagnóstica,  sino  para  mitigar
directamente  esta  crisis  de  dotación  de  personal.  La  lentitud  inherente  de  las  metodologías  visuales
tradicionales bajo un entorno con escasez de especialistas eleva críticamente el Turnaround Time (TAT)
u   horas   de   entrega   del   informe,   retrasando   la   instauración   de   terapias   antibióticas   dirigidas   y
comprometiendo de forma directa la seguridad del paciente ante cuadros infecciosos complejos (Graf et
al., 2025; Kirn, 2016).
- Exigencias  de  Estándares  Internacionales:  La  norma de  calidad  ISO  15189,  que rige  a  los  laboratorios
clínicos modernos, exige un control estricto sobre la trazabilidad de los datos y la minimización del error
humano en la fase analítica y de transcripción. Los flujos manuales carecen de auditorías visuales digitales
o registros fotográficos indexados, lo que dificulta la verificación posterior de lecturas dudosas.

El  abordaje  de  esta  problemática  trasciende  el  desarrollo  de  una  aplicación  convencional;  constituye  un
desafío complejo de arquitectura de sistemas informáticos, visión computacional aplicada y gobernanza de
datos biomédicos, estructurado bajo tres grandes retos disciplinares:

a. Optimización de Visión Computacional en el Borde (Edge AI)

Capturar  imágenes  de  placas  de  cultivo  mediante  la  cámara  de  un  dispositivo  móvil  a  mano  alzada
introduce condiciones ópticas altamente inestables y hostiles: variaciones drásticas en la iluminación del
mesón, sombras proyectadas por el operador y distorsiones geométricas por inclinación de la perspectiva.
El  desafío  de  ingeniería  de  software  consiste  en  diseñar  un  pipeline  de  procesamiento  digital  robusto
utilizando herramientas como OpenCV para ejecutar transformaciones afines automáticas que normalicen
y "enderecen"  la  placa.  Asimismo,  exige  la  optimización  y  empaquetamiento  de  Redes  Neurales
Convolucionales  (CNN)  ligeras —como  modelos  de  detección  de  objetos  y  segmentación  semántica
utilizando  arquitecturas  optimizadas  para  móviles.  Estos  modelos  deben  realizar  inferencias  en  tiempo
real  directamente  sobre  el  hardware  restringido  de  un  smartphone,  favoreciendo  un  rendimiento
subsegundo y una alta delimitación morfológica de las estructuras biológicas sin depender de servidores
en la nube (Cao et al., 2024; Ciftci et al., 2026).

b. Ruptura de la Opacidad Algorítmica (Inteligencia Artificial Explicable - XAI)

Los   modelos   tradicionales   de   aprendizaje   profundo   operan   habitualmente   como   "cajas   negras"
matemáticas,  lo  que  genera  una  legítima  resistencia  cultural  y  médica  en  el  ámbito  clínico.  El  reto
informático radica en empotrar algoritmos de interpretabilidad visual post-hoc, específicamente Grad-CAM
(Gradient-weighted Class Activation Mapping), corriendo localmente en el procesador del teléfono móvil.

## 9


Esto permite proyectar mapas de calor translúcidos sobre la pantalla del celular para evidenciar en tiempo
real qué características morfológicas o límites de pixeles está ponderando la red neuronal, otorgando la
transparencia requerida para la auditoría del especialista humano (Ciftci et al., 2026).

c. Arquitectura Decoupled e Interoperabilidad de Datos Médicos

Para  evitar  la  transcripción  manual,  la  solución  exige  el  desarrollo  de  un  componente  intermedio
(middleware) inalámbrico. Este componente debe capturar el archivo estructurado JSON con metadatos
de lectura enviado por la app móvil y transformarlo dinámicamente en mensajería estándar bajo la API
FHIR  de  HL7,  mapeando  las  variables  microbiológicas  a  las  ontologías  clínicas  globales  LOINC  y
SNOMED  CT. Adicionalmente,  el  software  debe  ser  future-proof:  la  IA  se  diseña  estrictamente  para
realizar  regresión  métrica  pura  (medir  diámetros  exactos  en  milímetros  a  nivel  de  píxeles).  La
interpretación clínica de susceptibilidad (Sensible, Intermedio o Resistente) se ejecuta en una capa lógica
de negocio completamente desacoplada del modelo, la cual consulta una base de datos local en formato
CSV actualizable. Esto favorece que el sistema se adapte de forma instantánea a los cambios anuales de
los  estándares  CLSI  o  EUCAST  sin  requerir  un  reentrenamiento  de  las  redes  neuronales  (Ciftci  et  al.,
## 2026).

La elección de este proyecto se justifica por su alineación con las tendencias globales en salud digital, su
escalabilidad  y  su  alto  impacto  social  en  el  entorno  local  chileno.  El  consenso  científico  internacional,
respaldado por la European Society of Clinical Microbiology and Infectious Diseases (Greutmann et al., 2025),
ratifica que las arquitecturas basadas en IA son una alternativa robusta para resolver la crisis de eficiencia
en los laboratorios.

El potencial de innovación de esta propuesta radica en que no compite con los grandes equipos cerrados de
los  laboratorios  centrales  de  Santiago;  por  el  contrario,  descentraliza  la  tecnología  de  alta  fidelidad.  Al
transformar un smartphone convencional en un dispositivo de soporte analítico interoperable, se provee una
solución democrática y de bajo costo para centros asistenciales regionales y periféricos de Chile.

La  adopción  de  una  estrategia  de  Código  Abierto  (Open-Source)  consolida  la  pertinencia  académica  y
profesional de la tesis. Al igual que los desarrollos de vanguardia internacional, La adopción de una estrategia
de Código Abierto (Open-Source) consolida la pertinencia académica y profesional de la tesis. Al igual que
los desarrollos de vanguardia internacional, que liberan sus modelos y arquitecturas en repositorios globales
como  Zenodo  (Bellundagi  et  al.,  2026)  para  fomentar  la  reproducibilidad  de  la  ciencia,  este  proyecto
disponibilizará su código. Esto favorece la total transparencia algorítmica, permite la colaboración e iteración
futura  de  la  comunidad  informática  chilena  y  elimina  las  barreras  económicas  de  entrada  asociadas  a
licencias  de  software  propietario  en  el  sector  público  de  salud,  alineándose  con  las  prácticas  globales  de
apertura de código para la validación independiente en la disciplina (Ciftci et al., 2026).

Sobre la base de las brechas tecnológicas analizadas y los requerimientos de la disciplina informática, se
establece explícitamente el foco de este desarrollo mediante la siguiente interrogante:

¿Cómo automatizar la interpretación de imágenes de ensayos microbiológicos mediante Inteligencia Artificial
móvil e interoperable, como soporte analítico en el laboratorio clínico?


## 10


El  impacto  positivo  derivado  de  resolver  este  desafío  se  distribuye  a  través  de  múltiples  dimensiones
operacionales  y  profesionales  dentro  del  ecosistema  clínico.  En  primer  lugar,  en  la  dimensión  técnica  e
informática,  el  principal  beneficio  proyectado  es la mitigación  significativa del  aislamiento  de  datos  en  el
mesón de trabajo (las denominadas "islas tecnológicas"). El indicador tecnológico de éxito para esta área se
consolidará  mediante  la  capacidad  del  sistema  para  realizar  una  generación  autónoma  de  mensajería
interoperable bajo el estándar HL7 FHIR, parametrizada con las codificaciones semánticas globales LOINC
y SNOMED CT a partir de los archivos JSON estructurados directamente en el borde móvil.

Desde  una  perspectiva  organizacional,  la  implementación  de  la  herramienta  persigue  la  mitigación  de  la
sobrecarga  laboral  mediante  la  liberación  de  la  carga  cognitiva  del  personal  y  una  profunda  optimización
horaria  de  los  flujos  rutinarios.  Este  impacto  se  medirá  técnicamente  a  través  de  la  automatización  del
descarte  de  placas  negativas  y  el  conteo  autónomo  de  colonias  bacterianas  ejecutado  en  milisegundos,
absorbiendo las tareas mecánicas que ralentizan el flujo productivo del laboratorio (Bellundagi et al., 2026).

En el ámbito de la calidad y seguridad, el proyecto se enfoca directamente en la reducción del error humano
derivado de la fatiga laboral y la variabilidad visual inter operador en lecturas manuales. El éxito tecnológico
en  esta  dimensión  se  evidenciará  al  lograr  precisiones  métricas  estables  y  consistentes  que  se  alineen
estrechamente  con  los  criterios  de  validación  de  microbiólogos  expertos,  proyectando  alcanzar  una
sensibilidad matemática superior al 90% en la detección y cuantificación de los ensayos biológicos.

Finalmente, en la dimensión ética y social, la solución busca promover la adopción de una inteligencia artificial
confiable, transparente y democratizada para las instituciones de salud regionales que carecen de acceso a
grandes  capitales  tecnológicos.  El indicador  de  éxito  fundamental  para  este  propósito  radica  en  la
transparencia analítica del software, favorecido por el despliegue en tiempo real de mapas de calor Grad-
CAM generados localmente en la interfaz del dispositivo, lo que asegura un entorno auditable que empodera
y resguarda el criterio del especialista bajo el paradigma cooperativo human-in-the-loop.

La naturaleza de este desafío de ingeniería delimita de forma estricta la metodología y el paso a paso técnico
del  proyecto.  Para  dar  respuesta  a  la  pregunta  central,  la  investigación  adopta  una  ruta  de  desarrollo
secuencial y lógica dividida en tres grandes etapas:

- Fase de Modelado y Datos: Optimización de Redes Convolucionales.

Para  la  estrategia  de  datos,  se  utilizará  el  dataset  oficial  público  AGAR  (https://agar.neurosys.com/),
comenzando inicialmente con un conjunto de prueba de 40 muestras sintéticas (trial version) para validar
el pipeline (prototyping). La división de particiones (entrenamiento, validación y prueba) se estructurará
rigurosamente  por  placa  o  paciente  único,  y  no  de  forma  aleatoria  por  recorte,  para  evitar  la  fuga  de
información (data leakage). Se entrenarán y validarán modelos ligeros basados en redes convolucionales
orientados a la regresión métrica y segmentación semántica de estructuras biológicas.

- Fase de Software Móvil: Pipeline Edge AI e Interfaces Transparentes.

Desarrollar la aplicación móvil nativa o híbrida. Programar el pipeline de visión computacional con OpenCV
para  la  corrección  geométrica  de  perspectiva  y  acoplar  los  motores  de  inferencia  locales  junto  con  la
visualización en pantalla de los mapas de calor Grad-CAM.

## 11


- Fase de Arquitectura de Conexión: Middleware de Interoperabilidad y Reglas Clínicas.

- Desacoplamiento Clínico: Implementar un motor lógico estrictamente separado del modelo de IA. La
inferencia visual generará únicamente métricas geométricas (mm), mientras que las reglas clínicas
(CLSI/EUCAST) interpretarán estos diámetros mediante consultas a un CSV local.
- Interoperabilidad  Práctica: El  middleware  estructurará  mensajes  JSON  bajo  el  protocolo  HL7  API
FHIR (Observation, Specimen, DiagnosticReport) codificados con LOINC y SNOMED CT. Se enviarán
estos recursos a un servidor FHIR público (como HAPI FHIR Test Server) para su validación sintáctica
y semántica.
- Seguridad por Diseño: Esta capa considerará la encriptación de transmisiones, autenticación, control
de acceso y trazabilidad, cumpliendo normativas clínicas.

En  conclusión,  este  proyecto  se  adscribe  al  ámbito  de  acción  de  Inteligencia  Artificial,  operando  como  un
catalizador directo de los procesos de Transformación Digital en salud. Su foco técnico prioritario no reside
en  la  automatización  robótica  de  hardware  físico,  sino  en  la  convergencia  inteligente  de  modelos  de
aprendizaje profundo optimizados para dispositivos móviles, técnicas de interpretabilidad visual post-hoc y
middlewares  estandarizados  para  la  unificación  de  datos  clínicos  aislados.  El  valor  profesional  de  esta
propuesta para la Ingeniería Civil Informática radica en demostrar la viabilidad de implementar soluciones de
Edge  AI  de  código  abierto,  seguras,  auditables  y  totalmente  integradas  a  las  arquitecturas  de  salud
preexistentes, resguardando en todo momento el criterio soberano del tecnólogo médico mediante un flujo
de trabajo cooperativo y normado bajo el estándar internacional de calidad ISO 15189.
VI. Relevancia e impacto del problema

La relevancia de este proyecto en el contexto contemporáneo radica en su capacidad para redefinir la frontera
de  la  transformación  digital  en  salud  mediante  el  uso  de  tecnologías  de  salud  móviles  (mobile  health
diagnostics). Tradicionalmente, la introducción de la inteligencia artificial en la microbiología clínica ha estado
confinada a grandes consorcios o costosos sistemas estacionarios de hardware corporativo. La propuesta
de  encapsular  modelos  de  aprendizaje  profundo  en  un  dispositivo  móvil  democratiza el  acceso  a  la
automatización  analítica,  elevando  la  competitividad  tecnológica  de  los  laboratorios  de  mediana  y  baja
complejidad que quedan rezagados ante las barreras económicas de la industria.

Este enfoque se alinea estratégicamente con los Objetivos de Desarrollo Sostenible (ODS) de las Naciones
Unidas, impactando directamente en el ODS 3 (Salud y Bienestar) a través de dos ejes operativos:

- Mitigación del Error por Fatiga: El despliegue de visión artificial para la preclasificación objetiva de cultivos
mitiga las tasas de error humano asociadas a la subjetividad y la fatiga ocular del operador en jornadas
de alta demanda diagnóstica.
- Fortalecimiento del Antibiotic Stewardship: La automatización de la lectura de halos de inhibición optimiza
el  análisis  de  la  susceptibilidad  antimicrobiana  (AST),  facilitando  el  diseño  de  terapias  dirigidas  que
fortalecen  los  programas  de  gestión  de  antibióticos  necesarios  para  contener  la  crisis  mundial  de
resistencia bacteriana (Ciftci et al., 2026).

El desarrollo de esta solución móvil y su correspondiente infraestructura de comunicación moviliza e integra
de manera nativa las competencias clave del perfil de egreso de la disciplina, enfrentando problemas de alta

## 12


complejidad ingenieril:

- Resolución  de  Problemas  Complejos:  Exige  el  diseño  de  arquitecturas  de  Deep  Learning  basadas  en
Redes  Neuronales  Convolucionales  (CNN)  capaces  de  extraer  información  espacial  precisa  a  partir  de
cuadrículas de datos biológicos (imágenes de placas de agar). Esto implica resolver retos no lineales de
alta dimensionalidad, escasez de datos etiquetados en entornos locales y el severo desequilibrio de clases
inherente a la distribución de patógenos clínicos.
- Gestión de Proyectos Tecnológicos e Interoperabilidad: El aseguramiento de la consistencia y trazabilidad
de  los  datos  biomédicos  demanda  la  modelación  rigurosa  de  flujos  de  trabajo  mediante  lenguajes  de
especificación  estructurados  (UML).  Asimismo,  requiere  la  orquestación  de  tuberías  ETL  (Extract,
Transform,  Load)  capaces  de  alimentar  almacenes  de  datos  clínicos  (Clinical  Data  Warehouses)  y  la
integración con el LIS mediante el uso estricto de estándares internacionales de comunicación y semántica
en salud como la API FHIR de HL7, LOINC y SNOMED CT.
- Capacidad de Innovación y Ética Tecnológica: El proyecto aborda directamente el "dilema del oráculo" y
el rechazo profesional justificado hacia los sistemas médicos de "caja negra". Esto se resuelve mediante
la  implementación  de  técnicas  de  Inteligencia  Artificial  Explicable  (XAI).  Si  bien  marcos  como  SHAP  o
DeepLift son referentes en la atribución de características tabulares, el proyecto innova al optimizar mapas
de  prominencia  visual  post-hoc  como  Grad-CAM  directamente  en  la  pantalla  del  dispositivo  móvil,
favoreciendo que el software provea razones y justificaciones visuales clínicamente interpretables por el
especialista humano (Ciftci et al., 2026).

La solución de ingeniería de software propuesta proyecta impactos altamente beneficiosos que desbordan el
ámbito técnico estricto del laboratorio, generando externalidades en múltiples dimensiones:

- Externalidad Económica y Laboral: Alivia los costos de mano de obra (labor costs) por examen analizado
al automatizar de forma portátil el tamizaje rutinario de las placas que resultan ser negativas, las cuales
representan entre el 84% y el 88.6% del volumen total del laboratorio (Faron et al., 2016). Esto responde
de  manera  directa  a  la  crisis  de  escasez  de  personal  calificado  que  afecta  a  la  industria  diagnóstica
contemporánea  (Graf  et  al.,  2025;  Kirn,  2016),  optimizando  la  asignación  de  recursos  financieros
institucionales.
- Externalidad  Social  en  la  Salud  Pública:  Al  sustituir  los  métodos  cualitativos  analógicos  por  una
cuantificación matemática exacta a nivel de píxeles para el recuento de colonias y la medición de halos,
se eliminan los errores latentes de digitación o mala interpretación visual. Esto impacta de forma directa y
positiva en la seguridad del paciente, previniendo fallas diagnósticas que afecten el pronóstico clínico de
las personas.
- Externalidad Ambiental y Operativa: El modelado inteligente del flujo de trabajo digital desde un dispositivo
móvil  previene  la  pérdida  física  de  muestras  biológicas  y  reduce  la  necesidad  de  repetir  pruebas
bioquímicas  manuales  fallidas  debido  a  interpretaciones  dudosas.  Esto  disminuye  colateralmente  la
generación  de  desechos  plásticos  (placas  de  Petri)  y  residuos  químicos  reactivos  en  el  laboratorio,
promoviendo un flujo desmaterializado (paperless).

Para  justificar  técnicamente  la  pertinencia  del  proyecto,  se  contrastaron  los  paradigmas  de  resolución
existentes frente a la propuesta de desarrollo móvil en la siguiente matriz analítica.



## 13


## Tabla 1
Análisis Comparativo de Arquitecturas de Automatización en Microbiología Clínica

## Dimensión
## Analítica
## Instrumentos
## Convencionales
## (VITEK-2 / BD
## Phoenix)
Sistemas de
## Automatización
Masiva (Copan
PhenoMATRIX)
## Solución Móvil
## Inteligente Propuesta
(CNN + Middleware
## LIS)
Costo de
## Entrada
Elevado; requiere la
adquisición de
hardware robótico
masivo y contratos
cerrados de reactivos.
Extremadamente alto;
confinado únicamente a
grandes centros de
referencia o redes
hospitalarias
centralizadas.
Mínimo; aprovecha la
infraestructura de
dispositivos móviles y
cámaras portátiles
preexistentes en el
mesón.
Portabilidad y
## Flexibilidad
Nula; hardware
estacionario pesado
que consume espacio
físico crítico dentro de
la planta del laboratorio.
Nula; exige la
reestructuración
completa de la planta
física para instalar
líneas robóticas e
incubadoras
inteligentes.
Inmediata; aplicación
portátil descentralizada
que interactúa de
manera inalámbrica con
los sistemas
informáticos.
Apertura de
Datos e
## Interoperabilid
ad
Deficiente; sistemas
antiguos que carecen
de interfaces de datos
detalladas para
interactuar con
plataformas externas.
Propietaria; ecosistema
cerrado que limita la
integración cross-
vendor con sistemas
LIS heterogéneos.
Abierta y Nativa;
middleware agnóstico
basado en API FHIR,
mapeando LOINC y
## SNOMED CT.
## Transparencia
y
## Explicabilidad
Inexistente; opera bajo
lógicas comerciales
opacas o sistemas
rígidos basados en
reglas fijas.
Baja; actúa como una
"caja negra" comercial
cerrada que impide la
auditoría interna de sus
criterios de predicción.
Alta; interfaz móvil con
capas XAI integradas
(Grad-CAM) para la
validación visual
interactiva del
operador.

Como  deja  entrever  el  análisis  comparativo,  el  mercado  actual  obliga  a  los  laboratorios  a  elegir  entre  la
ineficiencia del flujo manual analógico o la dependencia de costosos sistemas corporativos cerrados de tipo
"caja negra". Existe una brecha crítica en el desarrollo de soluciones de software independientes y portátiles
que permitan el descarte masivo de negativos y la medición objetiva de susceptibilidad en el mismo mesón
de trabajo, manteniendo al especialista en el ciclo mediante un esquema interactivo de validación (human-

## 14


in-the-loop).

La  viabilidad  técnica  del  proyecto  no  se  restringe  a  la  capacidad  de  hardware  de  gama  alta,  sino  que  se
fundamenta  estratégicamente  en  la  ubicuidad  y  compatibilidad  universal  de  la  solución  sobre  cualquier
teléfono inteligente estándar, común o de presupuesto acotado. Tal como se plantea en las tendencias de
despliegue local de la disciplina, la clave ingenieril para lograr que la aplicación sea agnóstica al dispositivo
radica en la optimización arquitectónica (Ciftci et al., 2026). La clave ingenieril para lograr que la aplicación
sea  agnóstica  al  dispositivo  y  corra  de  forma  fluida  en  procesadores  móviles  convencionales  radica  en  la
optimización y compresión arquitectónica de las redes neuronales.

Al aplicar técnicas de cuantificación post-entrenamiento (transformando los pesos del modelo desde punto
flotante  de  32  bits  a  enteros  de  8  bits,  o  INT8)  y  empaquetar  las  instrucciones  mediante frameworks  de
inferencia móvil, el tamaño del archivo y el consumo de memoria RAM se reducen en más de un 75%. Esto
permite  ejecutar  inferencias  locales  en  milisegundos  directamente  en  la  CPU  de  teléfonos  antiguos  o
económicos sin requerir chips de IA dedicados ni conexión a la nube, favoreciendo la viabilidad del despliegue
masivo en cualquier mesón de trabajo.

Para  asegurar  la  sostenibilidad  de  este  impacto  en  el  mediano  y  largo  plazo,  el  diseño  de  ingeniería  del
software aborda explícitamente dos desafíos operacionales críticos:

- Contención del Data Drift: Dado que correr la app en "cualquier teléfono" expone al sistema a una enorme
heterogeneidad de sensores de cámara y variaciones en la iluminación ambiental de las salas, el software
incorpora pipelines en OpenCV basados en la normalización de histogramas y transformaciones afines.
Esto mitiga el desplazamiento de datos (data drift), manteniendo estable la precisión predictiva sin importar
el modelo de smartphone utilizado.
- Cumplimiento Regulatorio y Calidad Analítica: La arquitectura se diseña reconociendo que la IA aplicada
al  diagnóstico  médico  se  clasifica  como  de  alto  riesgo  bajo  marcos  regulatorios  internacionales
contemporáneos como el EU AI Act. Por ello, el sistema incorpora logs de auditoría inalterables para cada
descarte  automatizado  y  alinea  sus  módulos  lógicos  con  los  estándares  internacionales  de  validación
instrumental de la enmienda CLIA y la norma de calidad clínica ISO 15189.

A  nivel  académico,  el  proyecto  sienta  las  bases  para  futuras  líneas  de  investigación  enfocadas  en  el
despliegue  de  modelos fundacionales  biomédicos  multimodales  ligeros  en  el  borde (Edge  AI),  abriendo  el
camino para el análisis automatizado de cultivos polimicrobianos complejos o la inferencia de fenotipos de
resistencia a partir de secuencias genómicas directamente desde interfaces portátiles y universales.

La alta relevancia clínica que reviste la manipulación y el reporte de patógenos humanos dicta de manera
inequívoca que el enfoque metodológico adoptado no puede dejar espacio a la ambigüedad matemática. La
necesidad  imperativa  de  proteger  la  salud  de  las personas  exige una reducción  sistemática de  los  falsos
negativos  en  la  fase  de  tamizaje.  Esto  justifica  técnicamente  la  decisión  de  utilizar  validaciones  cruzadas
rigurosas y optimizar las funciones de pérdida del modelo de Deep Learning para maximizar la sensibilidad
(Recall) sobre cualquier otra métrica global.

La  estructura  metodológica  del  informe  sigue  una  progresión  secuencial  dividida  en  tres  etapas  clave:
Modelado  (tratamiento  y  aumentación  de  datos  de  agar),  Software  Móvil  (optimización  de  la  interfaz  en

## 15


sistemas  embebidos)  y  Arquitectura  de  Conexión  (integración  inalámbrica  interoperable).  Esta  cohesión
técnica  permite  que  un  dispositivo  móvil  de  bajo  costo  transforme  datos  masivos  y  desestructurados  del
mesón de trabajo en conocimiento clínico seguro, seguro y estandarizado.
VII. Objetivo general y objetivos específicos

a. Objetivo General

Desarrollar un sistema de software móvil interoperable como apoyo inteligente para la interpretación visual
de  pruebas  diagnósticas,  con  el  propósito  de  estandarizar  los  ensayos  microbiológicos  en  los  laboratorios
clínicos.

b. Objetivos Específicos

- Analizar  y  especificar  los  requerimientos  técnicos,  clínicos  y  normativos  (tales  como  la  ISO  15189  y
directrices  regulatorias  vigentes)  involucrados  en  el  procesamiento  de  muestras  microbiológicas,  para
establecer la arquitectura de software y los protocolos de seguridad de los datos.
- Entrenar y optimizar modelos de aprendizaje profundo para su despliegue en entornos móviles (Edge AI),
orientados a priorizar la sensibilidad clínica (Recall) y asegurar la exactitud geométrica en la segmentación
de imágenes biológicas.
- Desarrollar  una  interfaz  de  usuario  móvil  que  integre  técnicas  de  Inteligencia  Artificial  Explicable  (XAI),
permitiendo la visualización de los mapas de características que justifican las predicciones algorítmicas,
promoviendo así un paradigma de validación interactiva (human-in-the-loop).
- Construir  un  middleware  de  integración  diagnóstica  agnóstico  al  hardware,  basado  en  estándares
internacionales de informática en salud, para estructurar y transmitir los resultados desde el dispositivo
móvil hacia los Sistemas de Información de Laboratorio (LIS).
- Validar el rendimiento del ecosistema de software mediante pruebas de precisión matemática, métricas
de   segmentación   y   simulaciones   de   interoperabilidad,   evaluando   su   impacto   proyectado   en   la
estandarización del flujo de trabajo y la mitigación de errores visuales.

La formulación de los objetivos presentados busca articular la dirección técnica del proyecto con la resolución
de la problemática diagnosticada, adhiriendo a los criterios de especificidad, mensurabilidad, alcanzabilidad,
relevancia  y  temporalidad  (SMART).  Esta  jerarquía  de  objetivos  funciona  como  un  eje central que  orienta
directamente la selección metodológica, las herramientas de desarrollo y la planificación del cronograma de
actividades.

El primer objetivo busca establecer la fundamentación teórica y normativa, condicionando el levantamiento
de  requisitos  previos  a  la  etapa  de  código.  Los  objetivos  segundo  y  tercero  promueven  la  adopción  de
infraestructuras específicas de modelamiento matemático y desarrollo móvil (como frameworks de Edge AI y
herramientas de explicabilidad), guiando las fases de iteración de los algoritmos en el cronograma. Por su
parte,  el  cuarto  objetivo  enfoca  el  diseño  del  backend  hacia  una  arquitectura  modular  interoperable,
motivando  el  uso  de  protocolos  estándar  de  la  industria  de  la  salud  para  facilitar  integraciones  flexibles.
Finalmente, el quinto objetivo permite proyectar una etapa de cierre del cronograma que contemple tiempos
concretos para la validación cruzada y la evaluación de métricas de rendimiento clínico, sugiriendo que cada
hito seleccionado responde sistemáticamente a la necesidad de construir una herramienta de apoyo analítico
robusta, estandarizada e implementable en laboratorios reales.

## 16


VIII. Alcances y limitaciones

a. Alcances del Proyecto

El desarrollo de este proyecto se delimita de manera estricta para asegurar su cumplimiento dentro del marco
del Seminario de Licenciatura en Ingeniería, estableciendo las siguientes fronteras:

## 1. Alcance Técnico

El proyecto comprende el diseño, entrenamiento y despliegue piloto de un sistema de software móvil basado
en modelos de aprendizaje profundo (Edge AI) para el procesamiento de imágenes de placas bacteriológicas.
Incluye el desarrollo de un algoritmo capaz de pre clasificar cultivos negativos, realizar recuento de colonias
y  medir  halos  de  inhibición,  así  como  la  construcción  de  un  middleware  de  interoperabilidad  diagnóstica
basado en estándares internacionales de informática en salud.

Exclusiones: Queda explícitamente excluido el desarrollo o modificación de hardware clínico estacionario
(como incubadoras automatizadas o brazos robóticos). Tampoco se desarrollará un Sistema de Información
de Laboratorio (LIS) completo, sino únicamente el puente de integración hacia él.

## 2. Alcance Metodológico

Se  abordará  la  recolección  y  preprocesamiento  de  imágenes clínicas,  el  entrenamiento  de  modelos
predictivos optimizados para maximizar la sensibilidad clínica y la implementación de interfaces explicables.
La evaluación se realizará mediante métricas matemáticas de precisión geométrica y validación cruzada in
vitro o en entornos de prueba simulados.

Exclusiones: No se llevarán a cabo ensayos clínicos reales con pacientes ni se alterarán los diagnósticos
oficiales durante el periodo de estudio. El sistema se formula exclusivamente como una herramienta de apoyo
(pre clasificación) y no de diagnóstico médico definitivo y autónomo.

## 3. Alcance Temporal

El ciclo de vida del proyecto está acotado al periodo académico establecido para el Seminario de Licenciatura
(Fase  1  y  posteriores),  abarcando  desde  la  formulación  y  diseño  arquitectónico  hasta  la  validación  de  las
métricas de software en simulaciones controladas, sin contemplar fases de mantenimiento a largo plazo ni
despliegue comercial.

b. Limitaciones del Proyecto

El avance de este proyecto está condicionado por las siguientes restricciones y barreras:

- Limitaciones Técnicas y Metodológicas

- Data   Drift   y   Variabilidad   Óptica:   El   procesamiento   de   imágenes   en   dispositivos   móviles   se   ve
inherentemente afectado por la variabilidad en la iluminación ambiental de los laboratorios y los reflejos

## 17


en las placas de agar, lo que restringe el rendimiento del modelo frente a capturas no estandarizadas.
- Dilema del Oráculo: Debido a que los modelos predictivos no pueden certificar una precisión del 100%, el
software  tiene  la  limitación  de  requerir  la  supervisión  y  validación  obligatoria  (human-in-the-loop)  del
profesional a cargo cuando los umbrales de confianza sean bajos.

- Limitaciones Contextuales y Regulatorias

Las  estrictas  normativas  de  privacidad  (ej.  anonimización  de  datos  del  paciente)  y  estándares  de  calidad
clínica  (ISO  15189,  EU  AI  Act, Ley  N°  21.719)  limitan  la  recolección  masiva  de  muestras  y  restringen  el
despliegue del sistema exclusivamente a entornos de prueba in vitro, impidiendo una integración real al flujo
hospitalario sin una certificación clínica previa, proceso que excede el tiempo del seminario.

## 3. Limitaciones Económicas

La incapacidad financiera para adquirir clústeres privados masivos de procesamiento de GPU o acceder a
bases de datos comerciales cerradas condiciona el entrenamiento del modelo a recursos computacionales
de nivel intermedio y al uso de datasets académicos de libre acceso.

c. Recursos Requeridos

Para la correcta ejecución técnica y metodológica, se proyecta la utilización de los siguientes recursos:

- Recursos  Humanos: El  estudiante  de  Ingeniería  Civil  Informática  a  cargo  del  diseño  y  desarrollo  del
software,  con  la  asesoría  teórica  de  docentes  guías  y,  de  ser  factible,  consultas  a  especialistas  en
microbiología (Tecnólogos Médicos) para la validación de la interfaz y la usabilidad.
- Recursos  Tecnológicos  y  Materiales: Equipos  computacionales  con  capacidad  de  procesamiento
intermedio (ej. GPU para entrenamiento local o plataformas cloud en su capa gratuita), dispositivos móviles
inteligentes  (smartphones)  para  las  pruebas  de  captura  en  el  borde  (Edge  computing),  y  entornos  de
desarrollo (Python, frameworks de IA y librerías de visión por computadora).
- Recursos   de   Información: Repositorios   de   datos   e   imágenes   microbiológicas   anonimizadas,
documentación  técnica  de  estándares  de  interoperabilidad  en  salud  (HL7,  FHIR),  y  literatura  científica
rigurosa extraída de bases de datos de corriente principal (IEEE Xplore, ACM, Scopus) que sustenten la
fundamentación teórica y el estado del arte.

d. Supuestos de Trabajo

El  desarrollo  de  este  software  asume  ciertas  condiciones  preexistentes  que  son  indispensables  para  su
validación:

- Disponibilidad  de  Datos: Se  asume  que  existen  datasets  públicos,  abiertos  y  con  calidad  suficiente
(correctamente etiquetados) de cultivos bacteriológicos y halos de inhibición para poder entrenar y probar
los algoritmos sin vulnerar políticas de privacidad.
- Infraestructura Receptora: Se presupone que el entorno de laboratorio simulado o conceptual cuenta
con  un  Sistema  de  Información  de  Laboratorio  (LIS)  con  capacidades  modernas  de  interoperabilidad
(APIs) capaz de recibir la información estructurada que enviará el middleware móvil.

## 18


e. Viabilidad y Alineación con el Proyecto

La definición estricta de estos alcances y limitaciones permite aterrizar la ambición clínica hacia un problema
de ingeniería de software acotado y realista. Al excluir el desarrollo de hardware, descartar la certificación
médica  legal  inmediata  (limitación  contextual)  y  delimitar  el  trabajo  al  entorno  móvil  (Edge  AI)  utilizando
datasets abiertos (supuesto), el proyecto favorece su viabilidad económica y temporal dentro del curso de
Seminario de Licenciatura.

Asimismo,  los  entregables  (modelo  entrenado,  aplicación  móvil  y  middleware)  son  plenamente  evaluables
mediante  métricas  informáticas  estandarizadas  (sensibilidad,  latencia  de  red,  error  de  segmentación
geométrica). Este marco metodológico promueve que el esfuerzo tecnológico se mantenga rigurosamente
alineado con el objetivo general: brindar un apoyo inteligente para estandarizar los procesos microbiológicos,
demostrando dominio de la disciplina sin desbordar el ámbito de competencia del ingeniero civil informático.
IX. Fundamentación teórica

a. El Problema de la Variabilidad en la Microbiología Clínica

Históricamente,   los  procedimientos   de   diagnóstico   microbiológico   clínico,   tales   como   la   lectura   de
antibiogramas (AST) y el recuento de colonias, han dependido casi exclusivamente de la inspección visual
humana. Este paradigma genera altos índices de variabilidad inter operador y demoras significativas en el
tiempo  de  respuesta  operativo  (Turnaround  Time),  afectando  la  eficiencia  de  los  laboratorios  frente  al
creciente desafío de la carga de trabajo. Para mitigar esta variabilidad, la literatura de vanguardia subraya la
necesidad  urgente  de  automatizar  y  estandarizar  la  captura  e  interpretación  de  ensayos  microbiológicos
mediante aproximaciones de ingeniería y ciencias de la computación (Singhal et al., 2025).

b. Visión Computacional y Aprendizaje Profundo (Deep Learning)

La incursión de la Inteligencia Artificial (IA) en el procesamiento de imágenes biomédicas ha demostrado ser
una herramienta formidable para estandarizar la métrica visual. Las arquitecturas de aprendizaje profundo
(Deep Learning) orientadas a la detección de objetos permiten localizar e interpretar zonas de inhibición o
conteo  bacteriológico  de  manera  automatizada  y  repetible.  Ciftci  et  al.  (2026)  demuestran  que  el  uso  de
modelos predictivos facilita la automatización del proceso de cuantificación, logrando que los algoritmos se
alineen  consistentemente  con  límites  biológicamente  relevantes  en  lugar  de  estar  sujetos  a  sesgos  de
percepción  subjetiva.  La  aplicación  de  estas  redes  neuronales  promueve  una  precisión  diagnóstica
sistemática  y  contribuye  a  reducir el  error  humano  intrínseco  a  las  tareas  repetitivas  en  los  mesones  de
laboratorio (Singhal et al., 2025).

c. Computación en el Borde (Edge AI) en Entornos Clínicos

Para  que  estas  soluciones  analíticas  sean  aplicables  en  entornos  clínicos  con  recursos  limitados  o  bajo
políticas de privacidad estrictas (como el manejo de muestras biológicas), la arquitectura tecnológica debe
descentralizarse. El paradigma de Inteligencia Artificial en el Borde (Edge AI) permite ejecutar los modelos
de  inferencia  directamente  en  dispositivos  móviles  (teléfonos  inteligentes),  sin  depender  de  la  latencia  o
transferencia  masiva  de datos  hacia  la  nube.  Investigaciones  aplicadas  como  la  de  Pascucci  et  al.  (2021)

## 19


validan  empíricamente  que  la  implementación  de  lecturas  automatizadas  mediante  aplicaciones  móviles
offline  es  un  enfoque  plenamente  factible.  Esta  descentralización  de  la  inferencia  gráfica  democratiza  el
acceso a tecnología de punta y resguarda al mismo tiempo la privacidad de los datos biomédicos procesados
localmente.

d. Interoperabilidad de la Información Médica

El  ciclo  de  ingeniería  de  software  en  salud  no  culmina  en  la  predicción  algorítmica  aislada  dentro  de  un
dispositivo  móvil;  los  datos  deben  ser  integrados  en  la  red  de  información  hospitalaria.  Es  un  requisito
transversal  que  los  resultados  estructurados  generados  por  el  algoritmo  puedan  ser  consumidos  por  un
Sistema de Información de Laboratorio (LIS). La integración de protocolos y estándares de interoperabilidad
semántica  e  integrativa  resulta  esencial  para  que  este  apoyo  inteligente  se  consolide  como  un nodo  de
trazabilidad confiable y escalable en la infraestructura hospitalaria (Singhal et al., 2025).

e. Síntesis y Alineación con el Proyecto

La conjunción disciplinar del Aprendizaje Profundo (para la certidumbre visual), el Edge AI (para la eficiencia
y  privacidad  local)  y  los  Estándares  de  Interoperabilidad  (para  la  cohesión  de  los  datos),  constituye  el
constructo teórico que sostiene este seminario. Mediante este marco, el proyecto se plantea superar la línea
base del procesamiento enteramente manual a través de un sistema de software inteligente, cuyo principal
propósito  ingenieril  es  proveer  apoyo  automatizado  para  estandarizar  los  análisis,  evitando  depender  de
arquitecturas propietarias rígidas y favoreciendo la escalabilidad técnica (Pascucci et al., 2021; Ciftci et al.,
## 2026).
X. Marco teórico y conceptual

a. Nivel General: Variabilidad Operacional en la Microbiología Clínica

En  los  laboratorios  de  microbiología  clínica,  los  procedimientos  convencionales  para  la  evaluación  de
ensayos fenotípicos —tales como la lectura del antibiograma por difusión en disco (método de Kirby-Bauer)
y el recuento cuantitativo de unidades formadoras de colonias (UFC)— han dependido históricamente de la
inspección visual humana. Este paradigma analógico presenta limitaciones operativas bien documentadas
en la literatura científica. La fatiga del operador, las inconsistencias en la iluminación ambiental de las áreas
de trabajo y la naturaleza subjetiva de la delimitación visual de bordes bacterianos difusos introducen una
variabilidad inter-operador e intra-operador sistemática (Pascucci et al., 2021; Singhal et al., 2025).

Asimismo, la creciente escasez de personal técnico calificado frente a un volumen ascendente de cultivos
diagnósticos genera un incremento en los tiempos de respuesta operativa (turnaround time), retrasando la
emisión de informes de susceptibilidad antimicrobiana críticos para la optimización terapéutica de pacientes
hospitalizados  (Salam  et  al.,  2023).  La  literatura  reciente  destaca  que  esta  variabilidad  técnica  justifica  la
necesidad  de  investigar  e  implementar  aproximaciones  computacionales  capaces  de  proveer  asistencia
objetiva y estandarización a las etapas de inspección visual en los mesones de laboratorio (Gullu et al., 2024;
Singhal et al., 2025).



## 20


b. Nivel Específico: Fundamentos Computacionales y Ópticos en el Borde

- Visión Artificial y Compensación del Desplazamiento de Dominio Óptico

La adquisición de imágenes biomédicas mediante cámaras de teléfonos inteligentes expone al sistema a una
marcada heterogeneidad instrumental y lumínica. La literatura especializada en calidad de datos e ingeniería
de  aprendizaje  automático  señala  que  las  variaciones  en  los  sensores  CMOS  móviles  y  la  iluminación
ambiental  no  controlada  alteran  la  distribución  espectral  y  degradan  la  calidad  del  conjunto  de  datos,
induciendo *data drift* o desplazamiento de dominio óptico (Gong et al., 2023).

Para mitigar estas distorsiones antes de la inferencia analítica, se requiere una cadena de preprocesamiento
fundamentada en dos ejes matemáticos:

- Normalización Cromática y Ecualización Adaptativa de Histogramas: Técnicas clásicas y adaptativas de
igualación  de  histogramas  (Contrast  Limited  Adaptive  Histogram  Equalization,  CLAHE)  y  normalización
espectral  permiten  remover  dominantes  cromáticas no  deseadas,  estandarizando  la  distribución  de
intensidades lumínicas en las placas de cultivo y preservando la integridad del dato visual (Gong et al.,
2023; Gullu et al., 2024).
- Transformaciones  Afines  y  Corrección  Proyectiva: El  empleo  de  operadores  de  geometría  proyectiva
permite rectificar inclinaciones angulares de la cámara respecto al plano de la placa de Petri, restituyendo
la ortogonalidad necesaria para mediciones métricas exactas en milímetros (Pascucci et al., 2021).
- - Pipeline Algorítmico y Calibración Física: El proceso de visión se ejecutará bajo la siguiente secuencia
estricta: Adquisición   de   la   imagen → Corrección   geométrica → Normalización   cromática →
Detección/Segmentación (YOLO) → Obtención de la medida → Transformación de Píxel a Milímetro. Para
esta  calibración  geométrica,  se  utilizará  un disco  de  antibiótico  estándar  de  6  mm como  anclaje  físico
(fiduciary  marker).  Este  método,  validado  clínicamente,  permite  mitigar  la  distorsión  de  perspectiva  y
asegurar la confiabilidad del error en milímetros.

- Redes Neuronales para Detección de Objetos en Tiempo Real

Para  superar  las  restricciones  de  los  métodos  basados  únicamente  en  umbrales  de  intensidad  o
transformadas  de  Hough,  las  arquitecturas  de  aprendizaje  profundo  (*Deep  Learning*)  han  redefinido  la
segmentación y detección en imágenes biomédicas:

- Evolución de Arquitecturas YOLO (You Only Look Once): Los detectores de disparo único en tiempo real
han evolucionado significativamente hacia la eficiencia computacional en el borde. Como señalan Wang
y  Liao  (2024),  las  iteraciones  recientes  han  refinado  el  balance  entre  exactitud  de  detección  y  costo
computacional.  En  particular,  la  arquitectura  YOLOv10  introdujo  el  entrenamiento  libre  de  supresión  de
no-máximos  (NMS-free  training)  mediante  asignación  dual  consistente,  reduciendo  la  latencia  de
postprocesamiento y eliminando cuellos de botella en la inferencia móvil (Wang et al., 2024).
- Evidencia Empírica en Ensayos de Difusión: Ciftci et al. (2026) demostraron la aplicabilidad de variantes
ultra-ligeras como YOLO11n para la detección y cuantificación simultánea de halos de inhibición en discos
antibióticos frente a patógenos como Escherichia coli y Staphylococcus aureus, alcanzando un coeficiente
de correlación R
## 2
= 0.98 y un error absoluto medio (MAE) de 0.42 mm en comparación con mediciones
manuales de referencia.

## 21


- Recuento Automatizado de Colonias: Bellundagi et al. (2026) y Nagy et al. (2023) comprobaron que las
redes convolucionales profundas y los detectores YOLO resuelven con alta fidelidad el conteo de colonias
bacterianas  en  medios  agarizados  complejos,  mitigando  los  errores  ocasionados  por  aglomeraciones
celulares o tamaños coloniales milimétricos.
- Cuantificación de Interacciones Antimicrobianas: Hallström et al. (2025) validaron que el procesamiento
automatizado  basado  en  redes  profundas  supera  la  variabilidad  humana  al  cuantificar  sinergias  e
interacciones entre múltiples antibióticos, asegurando límites biológicos reproducibles.

- Computación en el Borde (Edge AI) y Cuantización de Modelos

El despliegue de modelos predictivos en el punto de atención (point-of-care) o en el mesón de trabajo exige
prescindir  de  la  dependencia  continua  de  servidores  en  la  nube  (Cloud Computing),  evitando  latencias  de
red, interrupciones de conectividad y riesgos de exposición de datos clínicos sensibles (Singhal et al., 2025).
La  disciplina  de  la  Inteligencia  Artificial  en  el  Borde  (Edge  AI)  aborda  este  requerimiento  ejecutando  la
inferencia analítica de manera local en el propio dispositivo de captura (Shi et al., 2020).

Para viabilizar la ejecución en procesadores móviles comerciales sin hardware acelerador especializado, la
ingeniería de software recurre a estrategias rigurosas de compresión de modelos:

- Cuantización Post-Entrenamiento (Post-Training Quantization, PTQ): Técnica matemática que convierte
las   representaciones   de   parámetros   desde   precisión   de   punto   flotante   de   32   bits   (FP32)   a
representaciones  enteras  de  8  bits  (INT8).  Este  procedimiento  reduce  el  consumo  de  memoria  en
aproximadamente un 75% y disminuye significativamente la carga computacional y la disipación térmica
en CPUs móviles con una pérdida de precisión marginal (Gholami et al., 2022; Shi et al., 2020).
- Motores de Inferencia Embebidos: Runtimes especializados tales como TensorFlow Lite (TFLite / LiteRT)
y  ONNX  Runtime  Mobile  optimizan  la  ejecución  de  grafos  computacionales  al  delegar  operaciones
tensoriales  a  los  subsistemas  de  hardware  disponibles  en  el  smartphone  (CPU  multinúcleo  o  NPU),
garantizando  inferencias  en  el  orden  de  milisegundos  de  forma  completamente offline (Pascucci  et  al.,
## 2021).

Este diseño arquitectónico no solo optimiza la eficiencia técnica, sino que responde de manera inherente a
las normativas de gobernanza y privacidad de datos de salud (como la Ley N° 21.719 en Chile y estándares
internacionales  afines),  asegurando  que  el  procesamiento  de  las  imágenes  biomédicas  permanezca
confinado en el dispositivo físico.

c. Nivel Aplicado: Transparencia Clínica e Interoperabilidad

- Inteligencia Artificial Explicable (XAI) y Validación Human-in-the-Loop

El despliegue clínico de modelos de caja negra (black-box) conlleva el riesgo de que el personal de salud
adopte decisiones erróneas fundamentadas en correlaciones engañosas (artefactos de plástico, burbujas o
reflejos) o, en sentido inverso, incurra en el sesgo de automatización al delegar ciegamente el criterio analítico
en la herramienta computacional (Greutmann et al., 2024; Nguyen et al., 2025).

Para estructurar un sistema auditable y seguro, la literatura converge en dos pilares:

## 22


- Mapas  de  Atribución  Post-Hoc  (Grad-CAM): La  técnica Gradient-weighted  Class  Activation  Mapping
(Selvaraju et al., 2017) proyecta los gradientes de la última capa convolucional sobre la imagen de entrada,
generando  mapas  de  calor  que  señalan  las  áreas  determinantes  de  la  predicción.  Ciftci  et  al.  (2026)
corroboraron que el uso de Grad-CAM en la lectura de antibiogramas permite verificar que la atención de
la  red  coincide  con  las  fronteras  biológicas  del  halo  de  inhibición  y  no  con  artefactos  circundantes,
aportando transparencia y trazabilidad técnica.
- Validación  Interactiva  (Human-in-the-Loop,  HITL):  En  coherencia  con  los  requisitos  de  validación  de
métodos  y  revisión  de  resultados  automatizados  de  la  norma  NCh-ISO  15189:2022  (cláusulas  7.3.3  y
7.4.1.5) y las directrices para sistemas de IA médica clasificados como de alto riesgo (EU AI Act), el rol
del  software  se  restringe  al  triaje  y  apoyo  inteligente.  Nguyen  et  al.  (2025)  y  Pascucci  et  al.  (2021)
evidenciaron  empíricamente  que  un  esquema  HITL  permite  al  tecnólogo  médico  corregir  discrepancias
visuales  e  interactuar  en  tiempo  real  con  el  sistema,  elevando  la  exactitud  diagnóstica  acumulada  y
preservando el control facultativo sobre el dictamen final. Este enfoque XAI (Grad-CAM) no se limitará a
mostrar  un  mapa  de  calor,  sino  que  será  evaluado  cualitativamente  respecto  a  su  utilidad  clínica:  se
verificará si el profesional comprende la explicación visual, si esta aumenta su confianza y si le permite
auditar o identificar eficazmente los errores del modelo.

- Interoperabilidad en Salud y Estandarización FHIR

El  valor  operativo  de  un  sistema  de  diagnóstico  asistido  depende  de  su  capacidad  para  interoperar
fluidamente  con  el  ecosistema  informático  hospitalario,  integrando  los  resultados  con  los  Sistemas  de
Información de Laboratorio (LIS) y los Registros Clínicos Electrónicos (EHR) sin intervención manual (Singhal
et al., 2025).

Frente a la rigidez y heterogeneidad de versiones heredadas como HL7 v2, el estándar abierto HL7 FHIR
(Fast   Healthcare   Interoperability   Resources)   se   ha   establecido   como   la   referencia   global   para   la
interoperabilidad en salud digital (Saripalle et al., 2019):

- Modelo  de  Recursos  RESTful: FHIR  descompone  la  información  clínica  en  entidades  discretas  y
reutilizables  en  formato  JSON/XML.  En  el  marco  de  este  proyecto,  los  hallazgos  del  antibiograma  se
serializan en recursos estándar tales como ‘Observation’ (para diámetros y categorías de susceptibilidad),
‘Specimen’ (para la muestra bacteriana) y ‘DiagnosticReport’ (para el consolidado del ensayo) (Saripalle
et al., 2019).
- Interoperabilidad  Semántica  Normalizada: Para  evitar  ambigüedades  interpretativas  entre  distintos
fabricantes  de  software  de  salud,  el  marco  de  interoperabilidad  prescribe  la  codificación  terminológica
estricta:  LOINC  (Logical  Observation  Identifiers  Names  and  Codes)  para  identificar  las  pruebas  de
laboratorio  y  los  discos  de  antibióticos  utilizados,  y  SNOMED  CT  para  registrar  los  microorganismos
identificados y fenotipos de resistencia (Saripalle et al., 2019; Singhal et al., 2025).

d. Síntesis Teórica y Comparativa de Modelos

La  articulación  formal  de  las  bases teóricas  examinadas  se  estructura  a  través  de  un modelo jerárquico  y
secuencial diseñado para responder de forma directa a la problemática operativa del laboratorio clínico. En
este  modelo  convergen  la  necesidad  de  estandarización  analítica,  las  técnicas  de  visión  computacional  y
compresión en el borde, la explicabilidad mediante inteligencia artificial (XAI) y la interoperabilidad semántica

## 23


bajo  estándares  internacionales.  A  fin  de  preservar  la  fluidez  de  la  lectura  sin  prescindir  de  la  rigurosidad
visual, el esquema integral que ilustra la interacción jerárquica de estos componentes y su correspondencia
con el flujo metodológico del proyecto se detalla de manera explícita en el Anexo 1.

A  continuación,  se  presenta  una  tabla  comparativa  de  los  distintos  enfoques  tecnológicos  de  inferencia
considerados, resumiendo sus ventajas y limitaciones en el contexto del laboratorio clínico, y justificando las
decisiones arquitectónicas adoptadas para este proyecto.

## Tabla 2
Tabla Comparativa de Modelos Computacionales y Enfoques de Inferencia

## Enfoque /
## Tecnología
## Ventajas Técnicas Limitaciones
## Operativas
Justificación en el
## Proyecto
## Visión Clásica
(OpenCV
## Puro)
Bajo consumo
computacional,
determinismo
algorítmico, ejecución
universal en CPU.
Sensibilidad extrema a
artefactos, variaciones
de iluminación y
morfologías complejas
de agar.
Se reserva
exclusivamente para
normalización de
contraste, constancia
de color y corrección
proyectiva.
## Cloud
## Computing
(Inferencia
## Servidor)
Capacidad de cálculo
ilimitada, modelos de
gran escala (FP32).
Dependencia crítica de
internet, latencia de
transmisión, riesgo de
fuga de datos clínicos
sensibles.
Descartado como
arquitectura primaria;
se prioriza la autonomía
y confidencialidad en el
mesón clínico.
Edge AI
## Cuantizado
(INT8 en
## Smartphone)
Procesamiento offline a
utónomo, baja latencia
(<100 ms),
cumplimiento de
privacidad local (Ley
## 21.719).
Restricciones de
memoria física y
cómputo térmico en
chipsets móviles
económicos.
## Enfoque
adoptado: Maximiza la
viabilidad económica y
despliegue universal en
smartphones estándar.
## Inferencia Caja
Negra (Black-
## Box)
Implementación directa
sin capas adicionales
de explicabilidad.
Imposibilidad de
auditoría clínica,
desconfianza médica,
alto riesgo de sesgo de
automatización.
Descartado por
incompatibilidad con
normativas de calidad
clínica y seguridad
analítica.
XAI (Grad-
## CAM) +
Transparencia visual en
tiempo real, trazabilidad
Requiere cómputo de
gradientes adicional y
## Enfoque
adoptado: Promueve la

## 24


## Enfoque /
## Tecnología
## Ventajas Técnicas Limitaciones
## Operativas
Justificación en el
## Proyecto
## Human-in-the-
## Loop
de bordes,
preservación del criterio
del tecnólogo médico.
diseño de interfaz
especializada de
revisión.
conformidad con los
criterios de supervisión
facultativa y trazabilidad
analítica de la norma
NCh-ISO 15189:2022
(cláusulas 7.3.3 y
## 7.4.1.5).

e. Síntesis Integradora y Orientación Metodológica

El  marco  teórico  desarrollado  fundamenta  detalladamente  el  diseño  de  la  investigación  y  la  toma  de
decisiones técnicas para las siguientes fases del proyecto:

- Sustento  de  los  Objetivos: Proporciona  la  justificación  teórica  y  matemática  de  por  qué  los  objetivos
específicos se orientan hacia la compresión de modelos (Objetivo 2), el diseño de interfaces explicables
con  mapas  de  atención  (Objetivo  3)  y  la  interoperabilidad  mediante  middlewares  FHIR  (Objetivo  4),
superando la ambigüedad conceptual.
- Orientación de la Metodología: Determina que la fase de modelamiento debe centrarse en funciones de
pérdida  que  maximicen  la  sensibilidad  (Recall)  y  la  precisión  de  delimitación  métrica  (R
## 2
## ,  MAE),
estableciendo  que  la  captura  móvil  debe  estar  precedida  por  pipelines  deterministas  de  normalización
cromática.
- Decisiones Técnicas Justificadas: Permite justificar que la adopción de frameworks ligeros (YOLO11n
/  YOLOv10)  y  la  cuantización  a  INT8  no  corresponden  a  elecciones  arbitrarias,  sino  a  una  respuesta
calculada  a  las  restricciones  térmicas  y  de  memoria  de  los  smartphones  convencionales,  garantizando
que  el  sistema  opere  con  independencia  de  la  nube  y  en  consonancia  con  los  requisitos  de  control  de
gestión  de  datos  e  información  y  validación  técnica  establecidos  en  la  norma  NCh-ISO  15189:2022
(cláusulas 7.3.3 y 7.6.3).

XI. Marco metodológico

a. Enfoque y Tipo de Investigación

El   presente   proyecto   se   fundamenta   en   un enfoque   de   desarrollo   tecnológico   experimental   e
incremental, propio de la Ingeniería Civil Informática. La investigación adopta un diseño empírico-cuantitativo
orientado a la ingeniería de software aplicada a la salud (Pascucci et al., 2021; Singhal et al., 2025), cuyo
propósito  central  es  resolver  una  limitación técnica  concreta:  la  subjetividad  y  variabilidad  operativa  en  la
lectura visual en el laboratorio de microbiología clínica.

La metodología no busca formular nuevas hipótesis biológicas, sino diseñar, entrenar, integrar y evaluar un
ecosistema computacional desacoplado que opere localmente en dispositivos móviles (Edge AI), incorpore

## 25


interpretabilidad visual y estandarice la transmisión de datos hacia Sistemas de Información de Laboratorio
## (LIS).

b. Fases Metodológicas del Proceso de Desarrollo

El  proceso  metodológico  se  estructura  en  cinco  fases  continuas  y  trazables,  asegurando  correspondencia
unívoca con los objetivos específicos y el marco conceptual previamente establecido (Ver Anexo 2).

- Fase 1: Análisis y Levantamiento de Requerimientos (Objetivo Específico 1)

## Actividades:

- Análisis de criterios clínicos y puntos de corte interpretativos de las tablas EUCAST y CLSI.
- Levantamiento  de  requisitos  de  calidad  analítica  según  la  norma  ISO  15189:2022  (requisitos  de
trazabilidad preanalítica y verificación de observador).
- Análisis  de  la  Ley  N°  21.719  sobre  protección  de  datos  de  salud  en  Chile,  derivando  el  requerimiento
estricto de procesamiento *offline* en el borde para prescindir de la nube pública.
- Definición  formal  de  requerimientos  funcionales  (detección  de  discos,  medición  métrica  de  halos,
preclasificación  de  resistencia)  y  requerimientos  no  funcionales  (latencia  inferior  a  1  segundo,  peso  de
binarios menor a 25 MB, compatibilidad en Android API 28+).

- Fase 2: Diseño Arquitectónico y Conceptual (Objetivos Específicos 2, 3 y 4)

## Actividades:

- Diseño modular de la arquitectura del software en tres capas: (a) Capa de Normalización Óptica, (b) Capa
de Inferencia Neuronal en Borde con Explicabilidad, y (c) Capa de Interoperabilidad Hospitalaria.
- Diseño del pipeline de visión por computadora para compensar *data drift*, heterogeneidad lumínica de
sensores CMOS móviles y aberraciones de perspectiva.
- Definición  de  la  interacción Human-in-the-Loop (HITL)  en  la  interfaz  gráfica,  permitiendo  al  tecnólogo
médico revisar la superposición del mapa de calor Grad-CAM antes de emitir la validación.
- Modelado conceptual de los esquemas de intercambio de información mediante perfiles de recursos HL7
FHIR (`Observation`, `Specimen`, `DiagnosticReport`).

- Fase 3: Implementación y Optimización Tecnológica (Objetivos Específicos 2, 3 y 4)

## Actividades:

- Construcción del pipeline de preprocesamiento óptico determinista con OpenCV (conversión de espacios
de color, ecualización CLAHE y homografía para corrección proyectiva planar).
- Entrenamiento  de  detectores  compactos  de  disparo  único  (single-shot)  adaptados  a  difusión  en  disco
(YOLO11n / YOLOv10).
- Aplicación  de  Cuantización  Post-Entrenamiento  (*Post-Training  Quantization*,  PTQ)  para  convertir  los
grafos computacionales de FP32 a INT8, exportando a runtimes de baja latencia (TensorFlow Lite / LiteRT

## 26


y ONNX Runtime Mobile).
- Implementación  del  generador  de  mapas  de  activación  visual  basados  en  gradientes (Grad-CAM)  para
aislar las fronteras biológicas de inhibición.
- Desarrollo del microservicio/middleware para serialización de resultados analíticos a formato JSON-FHIR
codificado con LOINC y SNOMED CT.

- Fase 4: Validación y Evaluación Experimental (Objetivo Específico 5)

## Actividades:

- Evaluación analítica sobre conjuntos de datos estandarizados con placas de cultivo de referencia.
- Comparación  cuantitativa  del  diámetro  de  inhibición  obtenido  automáticamente  frente  a  mediciones
manuales de control (patrón de oro con pie de metro/regla milimétrica).
- Benchmarking Edge AI: Evaluación comparativa cuantitativa entre el modelo original (FP32) y el modelo
cuantizado (INT8). Se documentará la precisión, el tamaño de los pesos, el uso de RAM y la latencia para
demostrar el impacto real de la optimización en dispositivos de gama media.
- Medición experimental del perfil computacional en dispositivos móviles reales: latencia de ejecución por
inferencia (ms), uso de memoria RAM (MB) y disipación de temperatura estimada.
- Validación  de  conformidad  del  middleware  FHIR  mediante  herramientas  de  validación  sintáctica  y
semántica de esquemas de salud.

- Fase 5: Análisis de Resultados y Articulación Curricular

## Actividades:

- Análisis  estadístico  de  los  resultados  obtenidos  (error  cuadrático  medio,  dispersión  de  Bland-Altman  y
coeficientes de correlación lineal).
- Evaluación del aporte del sistema frente al problema de la variabilidad inter-operador diagnosticado en la
## Fase 1.
- Elaboración  del  informe  de  síntesis  y  estructuración  de  la  cartera  de  trabajo  para  la  fase  posterior  de
Anteproyecto de Título.

c. Selección y Justificación de Técnicas, Herramientas y Tecnologías

La selección de la pila tecnológica obedece a criterios de rigor de ingeniería: compatibilidad de estándares
abiertos, eficiencia de cómputo en hardware móvil y soberanía sobre los datos clínicos.










## 27


## Tabla 3
Selección y justificación técnica de la pila tecnológica y herramientas del proyecto.

Tecnología / Herramienta Rol Operativo en el Proceso Justificación Técnica de
## Selección
Python 3.10+ / PyTorch Entorno  de  experimentación,
modelamiento y
entrenamiento de redes
convolucionales.
Estándar  de  la  industria  para
desarrollo     de     modelos     de
aprendizaje    profundo;    amplia
disponibilidad   de   módulos   de
exportación a grafos
cuantizados (ONNX/TFLite).
OpenCV    (Open    Source
## Computer Vision)
Preprocesamiento óptico,
corrección proyectiva y
filtrado adaptativo (CLAHE).
Ejecución determinista y
ultrarrápida  en  CPU,  mitigando
el domain   shift óptico   de   las
cámaras    móviles    antes    de
alimentar la red neuronal.
YOLO11n / YOLOv10 Detección     de     discos     de
susceptibilidad y
segmentación   de   halos   de
inhibición en tiempo real.
Arquitecturas single-shot con
mecanismos de asignación dual
libre  de  NMS  (en  YOLOv10)  y
variantes  ultra-ligeras  nano  (n)
que maximizan  la  precisión  con
mínimo costo computacional.
TensorFlow  Lite  (LiteRT)  /
ONNX Runtime Mobile
Motores de inferencia
embebida local en el
smartphone (Edge AI).
Permiten ejecutar grafos
cuantizados a INT8
directamente  sobre  la  CPU  o
NPU    móvil    de    forma offline,
eliminando  la  latencia  de  red  y
resguardando     la     privacidad
local.
Grad-CAM (Gradient-
weighted  Class  Activation
## Mapping)
Generación  de  explicabilidad
visual     post-hoc     para     el
tecnólogo médico.
Aporta interpretabilidad sin
alterar la arquitectura base de la
red,   permitiendo   auditar   si   la
predicción  atiende  a  fronteras
biológicas   o   a   artefactos   del
plástico.
HL7   FHIR   (Release   4)   /
RESTful JSON
Estandarización de la
estructura de datos
interoperables  para  conexión
con LIS/HIS.
Referencia  internacional  abierta
en  interoperabilidad  en  salud;
descompone  los  resultados  en
recursos reutilizables
(Observation, DiagnosticReport)
con codificación semántica

## 28


Tecnología / Herramienta Rol Operativo en el Proceso Justificación Técnica de
## Selección
LOINC y SNOMED CT.
Git / GitHub Control     de     versiones     y
trazabilidad    de    código    y
documentación.
Asegura    reproducibilidad    de
experimentos,  modularidad  del
código fuente y buenas
prácticas    de    ingeniería    de
software.

d. Esquema Funcional y Arquitectura de la Solución

El flujo funcional describe cómo interactúan los componentes técnicos de software desde la adquisición de
la imagen hasta la emisión del reporte estructurado (Ver Anexo 3). Asimismo, para formalizar la ingeniería
de  software  subyacente  y  definir  con  precisión  las  interfaces,  dependencias  y  responsabilidades  de  cada
módulo móvil y externo, se presenta un diagrama de arquitectura basado en el modelo C4 (Ver Anexo 5).

e. Criterios de Evaluación y Métricas de Validación de Desempeño

Para evaluar rigurosamente el rendimiento de la Visión Computacional, las métricas se segregarán según la
naturaleza específica de la tarea:

- Detección de Objetos: Se utilizarán las métricas Precision, Recall, F1-Score y mAP.
- Segmentación: Se evaluará el solapamiento del halo predictivo mediante IoU (Intersection over Union) y
## Dice Coefficient.
- Error Físico (Medición): Se empleará un análisis de concordancia clínica mediante el método de Bland-
Altman adicional al Error Absoluto Medio (MAE).

- Precisión Geométrica y Analítica

- Error Absoluto Medio (MAE): Discrepancia métrica entre el diámetro automatizado y la medición manual
con pie de metro:

## 푀퐴퐸=
## 1
## 푁
## ∑|푑
## 푎푢푡표,푖
## −푑
## 푚푎푛푢푎푙,푖
## |
## 푁
## 푖=1

Criterio de aceptación: MAE ≤ 0.5 mm.

- Coeficiente de Determinación (R
## 2
): Nivel de ajuste lineal y concordancia global respecto al estándar de
referencia manual. Criterio de aceptación: R
## 2
## ≥ 0.95.
- Sensibilidad Diagnóstica (Recall): Capacidad del modelo para identificar correctamente todos los discos y
halos presentes, evitando falsos negativos críticos para la selección antibiótica. Criterio de aceptación: ≥
## 98.

## 29


- Eficiencia Computacional en el Borde

- Latencia  de  Inferencia  (t
inf
): Tiempo  total  de  cómputo  del  modelo  cuantizado  INT8  ejecutado  en  un
procesador móvil comercial. Criterio de aceptación: t
inf
< 800 ms.
- Consumo  de  Memoria  Volátil  (RAM): Sobrecarga  de  memoria  de  la  aplicación  en  tiempo  de  ejecución.
Criterio de aceptación: ≤ 150 MB.
- Tamaño del Binario del Modelo: Reducción dimensional alcanzada tras la cuantización PTQ. Criterio de
aceptación: ≤ 15 MB.

- Conformidad de Interoperabilidad y Confiabilidad

- Validez  de  Estructura  FHIR: Porcentaje  de  paquetes  de  datos  generados  que  pasan  sin  errores  la
validación formal del validador de perfiles HL7 FHIR R4. Criterio de aceptación: 100
- Tasa  de  Rechazo  o  Ajuste  en  HITL: Porcentaje  de  intervenciones  manuales  requeridas  por  el  usuario
especialista frente a discrepancias de lectura. Permite calibrar la autonomía del soporte visual.

f. Principios de Ingeniería Aplicados en la Toma de Decisiones

Las decisiones operativas y de diseño del proyecto se rigen por principios fundamentales de la disciplina de
la informática:

- Optimización  de  Recursos  y  Eficiencia: La  elección  de  arquitecturas  compactas  cuantizadas  a  INT8
responde a la necesidad de no saturar procesadores móviles convencionales ni exigir chips de aceleración
neuronal (NPU) de gama alta, habilitando el despliegue en laboratorios de bajos recursos.
- Confiabilidad y Seguridad por Diseño (Security by Design): Al realizar el procesamiento visual enteramente
en el hardware móvil de forma offline, se garantiza que las imágenes clínicas del paciente nunca salgan
del  dispositivo,  mitigando  vectores  de  ataque  y  cumpliendo  la  Ley  N°  21.719  de  protección  de  datos
personales.
- Mantenibilidad y Desacoplamiento: La separación estricta entre el módulo de visión, el motor de inferencia
y el middleware de integración permite actualizar o sustituir el detector de objetos sin alterar la estructura
de comunicación FHIR ni la lógica de la interfaz de usuario.
- Explicabilidad y Supervisión Humana: La adopción del paradigma human-in-the-loop respaldado por Grad-
CAM  previene  el  sesgo  de  automatización  y  asegura  el  cumplimiento  de  la  norma  ISO  15189,
salvaguardando la autoridad clínica del tecnólogo médico.

g. Justificación Metodológica y Proyección hacia la Titulación

La metodología experimental y orientada al diseño de artefactos seleccionada es la más adecuada para este
proyecto por las siguientes razones:

- Coherencia Interna: Articula de manera directa la necesidad diagnosticada en el problema (variabilidad y
lentitud analógica) con los fundamentos teóricos revisados (visión computacional, Edge AI, XAI y FHIR) y
los hitos del cronograma.
- Alineación con la Línea de Titulación: En el contexto de este Seminario de Licenciatura, esta metodología
permite consolidar la arquitectura de software, validar los supuestos técnicos y delimitar los componentes

## 30


teóricos.
- Proyección  Hacia  el  Anteproyecto  y  Proyecto  de  Título:  Provee  una  base  sólida  para  que,  en  las
asignaturas posteriores de la línea de titulación (Anteproyecto y Memoria de Título), el esfuerzo se focalice
en  la  implementación  del  pipeline  de  código  final, la  calibración  empírica  con  datasets  microbiológicos
masivos y la evaluación del software en ensayos de campo con usuarios clínicos reales.
XII. Planificación y cronograma

a. Supuestos Temporales y Restricciones del Proyecto

Para la correcta ejecución del presente cronograma, se establecen los siguientes lineamientos basales que
enmarcan la temporalidad y viabilidad del desarrollo.

## 1. Supuestos Temporales

- Duración del ciclo: El desarrollo del proyecto abarca un período de 11 meses, con inicio formal el 17 de
junio de 2026 y finalización programada para mayo de 2027 con la defensa o presentación final.
- Alineación  académica: La  ejecución  de  las  fases  metodológicas  se  estructura  en  coherencia  con  la
progresión de la línea de titulación (Seminario de Licenciatura, Anteproyecto y Proyecto de Título).
- Disponibilidad tecnológica: Se asume un acceso continuo a los entornos de desarrollo requeridos (Python,
librerías de visión artificial) y a la documentación oficial de los estándares de interoperabilidad hospitalaria.

- Restricciones del Proyecto

- Restricción de calendario: Las fechas límite de los entregables y la presentación final están estrictamente
condicionadas por el calendario institucional de la universidad.
- Recursos  humanos:  El  proyecto  es  concebido  y  desarrollado  por  un  único  responsable  (el  estudiante
investigador),  quien  asume  los  roles  integrales  de  análisis,  diseño  arquitectónico,  implementación  y
evaluación.
- Limitaciones de prueba: Las validaciones experimentales iniciales están restringidas al uso de dispositivos
móviles  comerciales  estándar  y  a  conjuntos  de  datos  de  prueba,  con  el  objetivo  de  preservar  la
confidencialidad y alinearse con las normativas de protección de datos (Ley N° 21.719).

b. Detalle de Fases, Hitos y Entregables

La siguiente tabla desglosa la secuenciación de las actividades a realizar. Debido a la naturaleza del proyecto,
el responsable único para todas las fases, hitos y entregables es Cristian Melián Ferrada.









## 31


## Tabla 4
Fases del proyecto

## Fase
## Metodológica
Descripción de Actividades Hito / Entregable
## Principal
## Dependencias
Fase 1: Análisis y
## Requerimientos
Levantamiento del estado del
arte, revisión de normas (ISO
15189) y definición de
requerimientos funcionales
del sistema.
## Entregable: Documento
de    especificación    de
requerimientos.
## N/A
Fase 2: Diseño de
## Arquitectura
Modelamiento  conceptual  de
los   módulos   de   visión   por
computadora, inferencia en el
borde e interoperabilidad.
Hito: Arquitectura de
software aprobada.
## Fase 1
## Fase 3:
## Implementación
## Tecnológica
Desarrollo del prototipo,
entrenamiento de redes
convolucionales  compactas  y
estructuración del middleware
## FHIR.
## Entregable: Prototipo
funcional (Versión
## Beta).
## Fase 2
## Fase 4:
## Validación
## Experimental
Ejecución    de    pruebas    de
rendimiento (latencia,
consumo    de    memoria)    y
evaluación del error métrico.
Hito: Resultados de
validación tabulados.
## Fase 3
Fase 5: Síntesis y
## Titulación
Elaboración del informe
consolidado, análisis del
impacto   en   la   variabilidad
inter-operador  y  preparación
de la defensa.
## Entregable: Informe
Final y Presentación.
## Fase 4

c. Carta Gantt del Proyecto

La representación gráfica a continuación ilustra la distribución temporal y secuencial de las cinco fases a lo
largo del ciclo de vida del proyecto.










## 32


## Figura 1
Cronograma general del proyecto. Fuente: elaboración propia mediante Mermaid, 2026.

XIII. Conclusiones generales

El desarrollo de este proyecto de titulación en su Fase 3 ha permitido consolidar una propuesta estructurada
desde la Ingeniería Civil Informática frente a una problemática técnica presente en la microbiología clínica: la
variabilidad inter-operador y la demora en los tiempos de respuesta derivados de la lectura visual manual en
los ensayos de difusión en disco.

A través del proceso investigativo y de diseño, se alcanzaron diversos hitos en coherencia con los objetivos
propuestos.  En  primer  lugar,  se  definieron  los  requerimientos  del  sistema  en  estricta  alineación  con  las
normativas de calidad (ISO 15189) y de protección de datos en salud. Esto orientó el diseño conceptual hacia
una arquitectura de procesamiento local que mitiga los riesgos de exposición de datos clínicos. A partir de
estos  requerimientos,  se  estableció  un  flujo  de  trabajo  computacional  que  integra el  preprocesamiento  de
imágenes  para  compensar  variaciones  ópticas  y  el  uso  de  redes  convolucionales  compactas.  De  esta
manera, se logró explorar la viabilidad de realizar inferencias ágiles en dispositivos móviles comerciales sin
depender de infraestructura avanzada.

Además,  el  diseño  incorporó  el  paradigma  de  colaboración  humano-computadora  (Human-in-the-Loop),
respaldado por mapas de atribución visual. Este enfoque busca asistir al tecnólogo médico, ofreciendo un
soporte transparente para la toma de decisiones en lugar de un sistema de diagnóstico opaco. Para asegurar
la  utilidad  de  los  resultados,  se  propuso una  estructura  de  integración  basada  en  el  estándar  HL7  FHIR,
orientada a facilitar la comunicación sistemática de los hallazgos analíticos con los Sistemas de Información
de Laboratorio (LIS). Finalmente, se definió un marco de verificación cuantitativa con métricas de desempeño
específicas (tales como umbrales de latencia subsegundo y error métrico milimétrico), sentando las bases
metodológicas  para  evaluar  de  forma  objetiva  la  precisión  y  eficiencia  del  modelo  en  las  futuras  etapas
experimentales.



## 33


El  trabajo  desarrollado  aporta  a  la  disciplina  desde  múltiples  dimensiones  interconectadas.  En  el  ámbito
conceptual,   se   promueve   un   enfoque   de   asistencia   inteligente   colaborativa,   distanciándose   de   la
automatización completa y priorizando el resguardo del criterio clínico del especialista. Metodológicamente,
se propone una estructura que integra requerimientos normativos en salud, diseño de software y métricas de
validación,  ofreciendo  un  esquema replicable  para  futuros  proyectos  interdisciplinarios.  A  nivel  técnico,  se
plantea  una  integración  entre  tecnologías  de  procesamiento  en  el  borde  (Edge  AI)  y  estándares  de
interoperabilidad  de  salud,  buscando  superar  las  limitaciones  de  memoria  y  procesamiento  del  hardware
móvil para entregar respuestas locales, rápidas y seguras.

Desde  la  perspectiva  social  y  sanitaria,  el  sistema  proyecta  un  impacto  relevante.  Por  un  lado,  aspira  a
democratizar  el  acceso  a  herramientas  analíticas  estandarizadas  en  laboratorios  con  recursos  limitados,
donde la inversión en equipos de alto costo resulta inviable. Por otro, al promover la interoperabilidad nativa
de  los  resultados,  la  propuesta  podría  contribuir  de  manera  eficiente  a  la  vigilancia  epidemiológica  de  la
resistencia antimicrobiana, apoyando directamente la toma de decisiones en el ámbito de la salud pública.

Para  dar  continuidad  a  esta  investigación  y  consolidar  la  viabilidad  del  sistema  en  las  siguientes  etapas
formativas,  se  proyectan  diversas  líneas  de  trabajo  sucesivas.  Inicialmente,  resulta  pertinente  explorar
algoritmos complementarios de segmentación que permitan evaluar no solo halos de inhibición, sino también
morfologías  y  el  conteo  de  colonias  bacterianas  en  distintos  medios  de  cultivo.  En  paralelo,  se  sugiere
investigar  estrategias  de  aprendizaje  colaborativo,  como Federated  Learning,  que  permitan  mejorar  la
capacidad de generalización del modelo a partir de datos de múltiples centros sin vulnerar la privacidad de
la información clínica.

En las asignaturas de Anteproyecto y Proyecto de Título, el esfuerzo deberá centrarse en implementar un
prototipo  funcional  para realizar  pruebas  de  usabilidad  con  profesionales  del  área  y  evaluar  la  integración
práctica  con  servidores LIS  de  prueba  en  entornos  clínicos  simulados.  Por  último,  se requiere  estudiar  en
profundidad los marcos regulatorios aplicables al software como dispositivo médico (SaMD), con el propósito
de alinear el desarrollo tecnológico futuro con los exigentes estándares de certificación de calidad sanitaria.
XIV. Bibliografía

Bellundagi, V., Deshapande, A., & Yadahalli, P. (2026). Automated bacteria colony counting using YOLO-
based deep learning and image processing techniques. International Journal of Scientific Research
and Technology, 3(7), 90–96. https://zenodo.org/records/21237433 [cite: 2, 5]

Cao, L., Zeng, L., Wang, Y., Cao, J., Han, Z., Chen, Y., ... & Qiao, S. (2024). U2-Net and ResNet50-Based
Automatic Pipeline for Bacterial Colony Counting. Microorganisms, 12(1), 201.
https://doi.org/10.3390/microorganisms12010201 [cite: 2, 5]

Ciftci, F., Erarslan, A., & Rahebi, J. (2026). Automatic detection and quantification of antimicrobial inhibition
zones using YOLO11n with post-hoc interpretability validation. Frontiers in Microbiology, 17, Artículo
- https://doi.org/10.3389/fmicb.2026.1810754 [cite: 3, 5]

Clinical and Laboratory Standards Institute. (2026). Performance standards for antimicrobial susceptibility
testing (36th ed., CLSI supplement M100). Clinical and Laboratory Standards Institute.

## 34


European Committee on Antimicrobial Susceptibility Testing. (2026). Breakpoint tables for interpretation of
MICs and zone diameters (Version 16.0). http://www.eucast.org

Faron, M. L., Buchan, B. W., Coon, C., Liebregts, T., van Bree, A., Jansz, A. R., Soucy, G., Korver, J., &
Ledeboer, N. A. (2016). Automatic digital analysis of chromogenic media for vancomycin-resistant-
enterococcus screens using Copan WASPLab. Journal of Clinical Microbiology, 54(10), 2470–2475.
https://doi.org/10.1128/jcm.01040-16

Gholami, A., Kim, S., Dong, Z., Yao, Z., Mahoney, M. W., & Keutzer, K. (2022). A survey of quantization
methods for efficient neural network inference. En B. Zadrozny et al. (Eds.), Low-Power Computer
Vision (pp. 291–326). Chapman and Hall/CRC. https://doi.org/10.1201/9781003162810-13

Gong, Y., Liu, G., Xue, Y., Li, R., & Meng, L. (2023). A survey on dataset quality in machine learning.
Information and Software Technology, 162, Artículo 107268.
https://doi.org/10.1016/j.infsof.2023.107268

Graf, E., Soliman, A., Marouf, M., Parwani, A. V., & Pancholi, P. (2025). Potential roles for artificial
intelligence in clinical microbiology from improved diagnostic accuracy to solving the staffing crisis.
American Journal of Clinical Pathology, 163(2), 162–168. https://doi.org/10.1093/ajcp/aqae107

Greutmann, M., Borgwardt, K., Brüningk, S., Franzeck, F., Giske, C. G., Green, A. G., ... & Egli, A. (2025).
ESCMID workshop: Artificial intelligence and machine learning in medical microbiology diagnostics.
Microbes and Infection, 27(105562). https://doi.org/10.1016/j.micinf.2025.105562

Gullu, E., Bora, S., & Beynek, B. (2024). Exploiting image processing and artificial intelligence techniques
for the determination of antimicrobial susceptibility. Applied Sciences, 14(9), Artículo 3950.
https://doi.org/10.3390/app14093950

Hallström, E., Fatsis-Kavalopoulos, N., Bimpis, M., Wählby, C., Hast, A., & Andersson, D. I. (2025).
CombiANT reader: Deep learning-based automatic image processing tool to robustly quantify
antibiotic interactions. PLOS Digital Health, 4(7), Artículo e0000669.
https://doi.org/10.1371/journal.pdig.0000669

Health Level Seven International. (2019). HL7 FHIR Release 4: Fast Healthcare Interoperability Resources.
http://hl7.org/fhir/

International Organization for Standardization. (2022). Medical laboratories — Requirements for quality and
competence (Norma ISO No. 15189:2022). https://www.iso.org/obp/ui/#iso:std:iso:15189:ed-4:v1:es

Kirn, T. J. (2016). Automatic digital plate reading for surveillance cultures. Journal of Clinical Microbiology,
54(10), 2424–2426. https://doi.org/10.1128/JCM.01279-16 [cite: 4, 5]

Khalaf, W. S., Morgan, R. N., & Elkhatib, W. F. (2025). Clinical microbiology and artificial intelligence:
Different applications, challenges, and future prospects. Journal of Microbiological Methods, Artículo
- https://doi.org/10.1016/j.mimet.2025.107125

## 35


Nagy, B., Makrai, L., Csabai, I., & Tőzsér, D. (2023). Bacterial colony size growth estimation by deep
learning. BMC Microbiology, 23, Artículo 307. https://doi.org/10.1186/s12866-023-03053-y

Nguyen, H. B., Phan, T. L., Ung, T. T., & Nguyen, T. K. (2025). Disc Diffusion Reader: An AI-powered
potential solution to combat antibiotic resistance in developing countries. The Journal of Infection in
Developing Countries, 19(5), 699–711. https://doi.org/10.3855/jidc.21108

Pascucci, M., Royer, G., Adamek, J., Al Asmar, M., Aristizabal, D., Blanche, L., Bezzarga, A., Boniface-
Chang, G., Brunner, A., Curel, C., Dulac-Arnold, G., Fakhri, R. M., Malou, N., Nordon, C., Runge, V.,
Samson, F., Sebastian, E., Soukieh, D., Vert, J.-P., Ambroise, C., & Madoui, M.-A. (2021). AI-based
mobile application to fight antibiotic resistance. Nature Communications, 12(1), Artículo 1173.
https://doi.org/10.1038/s41467-021-21187-3

Salam, M. A., Al-Amin, M. Y., Pawar, J. S., Akhter, N., & Lucy, I. B. (2023). Conventional methods and
future trends in antimicrobial susceptibility testing. Saudi Journal of Biological Sciences, 30(3),
Artículo 103582. https://doi.org/10.1016/j.sjbs.2023.103582

Saripalle, R., Runyan, C., & Russell, M. (2019). Using HL7 FHIR to achieve interoperability in patient health
record. Journal of Biomedical Informatics, 94, Artículo 103188.
https://doi.org/10.1016/j.jbi.2019.103188

Selvaraju, R. R., Cogswell, M., Das, A., Vedaldi, A., Parikh, D., & Batra, D. (2017). Grad-CAM: Visual
explanations from deep networks via gradient-based localization. IEEE International Conference on
Computer Vision (ICCV), 618–626. https://doi.org/10.1109/ICCV.2017.74

Shi, Y., Yang, K., Jiang, T., Zhang, J., & Letaief, K. B. (2020). Communication-efficient edge AI: Algorithms
and systems. IEEE Communications Surveys & Tutorials, 22(4), 2167–2191.
https://doi.org/10.1109/COMST.2020.3007787

Singhal, N., Vardhan, H., Jain, R., Gupta, P., Pandey, A., Wagri, N. K., & Gaur, A. (2025). Role of artificial
intelligence in automating diagnostic procedures in clinical microbiology laboratories. Biotechnology
Advances, 82, Artículo 108390. https://doi.org/10.1016/j.biotechadv.2024.108390

Wang, A., Chen, H., Liu, L., Chen, K., Lin, Z., Han, J., & Ding, G. (2024). YOLOv10: Real-time end-to-end
object detection. arXiv preprint arXiv:2405.14458. https://doi.org/10.48550/arXiv.2405.14458

Wang, C.-Y., & Liao, H.-Y. M. (2024). YOLOv1 to YOLOv10: The fastest and most accurate real-time object
detection systems. arXiv preprint arXiv:2408.09332. https://doi.org/10.48550/arXiv.2408.09332




## 36


XV. Anexos
Anexo 1: Diagrama Conceptual del Marco Teórico. Fuente: elaboración propia, 2026.




## Estandarizado
(Tria e mo il o  line y a ditable)



( rad CAM, mitigacion de sesgo,
NCh I    5  9)

## ( L    I , L INC,  N MED CT)


(CLA E, correccion a in y color)

(  L   0     L   n,
in erencia NM   ree)

(C antizacion  T  INT ,
motores T Lite    NN )


(  b eti idad,  atiga y retraso TAT)

## 37


Anexo 2: Flujo de Fases Metodológicas. Fuente: elaboración propia, 2026.


## 38


Anexo 3: Secuencia Funcional y Arquitectura. Fuente: elaboración propia, 2026.



## 39


Anexo 4: Algoritmos de Entrenamiento y Optimización en Borde. Fuente: elaboración propia, 2026.
Fragmentos de código representativos que evidencian el desarrollo computacional de los modelos de Deep
Learning (YOLO11n) y la aplicación de cuantización Post-Training Quantization (PTQ INT8) para su
despliegue y ejecución sin conexión a internet (Edge AI).

A. Rutina de Entrenamiento (Fragmento de `train_yolo.py`)
## ```python
def train_yolo_microbiology(epochs=100, imgsz=640, batch=None):
## """
Train YOLO11n model on AGAR microbiology dataset.
Auto-detects CPU vs GPU environment.
## """
device = 0 if torch.cuda.is_available() else 'cpu'
if batch is None:
batch = 16 if device == 0 else 8

print(f"Starting YOLO11n training on device: {device} (batch size: {batch})...")

model = YOLO("yolo11n.pt")
config_path = str(CONFIGS_DIR / "dataset.yaml")

results = model.train(
data=config_path,
epochs=epochs,
imgsz=imgsz,
batch=batch,
device=device,
patience=20,
save=True,
project=str(RESULTS_DIR),
name="yolo11n_microbiology",
workers=4 if device == 'cpu' else 8,
## )
return results
## ```

B. Rutina de Optimización y Exportación Edge (Fragmento de `export_model.py`)
## ```python
def export_model_for_edge(weights_path, format_type='onnx', int8_quantize=True):
## """
Export trained PyTorch YOLO model to Edge AI formats:
- ONNX Runtime
- TFLite (with optional INT8 post-training quantization)
## """
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
print(f"Exporting model {weights_path} to {format_type.upper()} format (INT8: {int8_quantize})...")

model = YOLO(weights_path)
exported_path = model.export(
format=format_type,
int8=int8_quantize,

## 40


dynamic=False,
imgsz=640
## )

print(f"Export successful. Artifact saved to: {exported_path}")
return exported_path
## ```


## 41


Anexo 5: Diagrama de Arquitectura de Software C4. Fuente: elaboración propia, 2026.

