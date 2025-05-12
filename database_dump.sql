--
-- PostgreSQL database dump
--

-- Dumped from database version 15.12 (Debian 15.12-1.pgdg120+1)
-- Dumped by pg_dump version 15.12 (Debian 15.12-1.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: trigger_set_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_set_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.fecha_actualizacion = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: trigger_set_timestamp_usuarios(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_set_timestamp_usuarios() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.fecha_actualizacion = NOW();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: capitulos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capitulos (
    id integer NOT NULL,
    serie_id integer NOT NULL,
    numero_capitulo integer NOT NULL,
    titulo_capitulo character varying(255),
    fecha_creacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: capitulos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.capitulos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: capitulos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.capitulos_id_seq OWNED BY public.capitulos.id;


--
-- Name: intervenciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intervenciones (
    id integer NOT NULL,
    take_id integer NOT NULL,
    personaje_id integer NOT NULL,
    dialogo text,
    completo boolean DEFAULT false,
    tc_in character varying(20),
    tc_out character varying(20),
    orden_en_take integer,
    fecha_creacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    usuario_id integer
);


--
-- Name: intervenciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.intervenciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: intervenciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.intervenciones_id_seq OWNED BY public.intervenciones.id;


--
-- Name: personajes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personajes (
    id integer NOT NULL,
    nombre_personaje character varying(255) NOT NULL,
    actor_doblaje character varying(255),
    fecha_creacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: personajes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.personajes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: personajes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.personajes_id_seq OWNED BY public.personajes.id;


--
-- Name: series; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.series (
    id integer NOT NULL,
    numero_referencia character varying(100),
    nombre_serie character varying(255) NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: series_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.series_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: series_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.series_id_seq OWNED BY public.series.id;


--
-- Name: takes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.takes (
    id integer NOT NULL,
    capitulo_id integer NOT NULL,
    numero_take integer NOT NULL,
    tc_in character varying(20),
    tc_out character varying(20),
    fecha_creacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: takes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.takes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: takes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.takes_id_seq OWNED BY public.takes.id;


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- Name: capitulos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capitulos ALTER COLUMN id SET DEFAULT nextval('public.capitulos_id_seq'::regclass);


--
-- Name: intervenciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intervenciones ALTER COLUMN id SET DEFAULT nextval('public.intervenciones_id_seq'::regclass);


--
-- Name: personajes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personajes ALTER COLUMN id SET DEFAULT nextval('public.personajes_id_seq'::regclass);


--
-- Name: series id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series ALTER COLUMN id SET DEFAULT nextval('public.series_id_seq'::regclass);


--
-- Name: takes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.takes ALTER COLUMN id SET DEFAULT nextval('public.takes_id_seq'::regclass);


--
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- Data for Name: capitulos; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.capitulos (id, serie_id, numero_capitulo, titulo_capitulo, fecha_creacion, fecha_actualizacion) FROM stdin;
1	3	39	Capítulo 39	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
\.


--
-- Data for Name: intervenciones; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.intervenciones (id, take_id, personaje_id, dialogo, completo, tc_in, tc_out, orden_en_take, fecha_creacion, fecha_actualizacion, usuario_id) FROM stdin;
1	1	14	Konponketa negoziazioa	f	\N	\N	0	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
2	1	8	(ad lib)	f	\N	\N	1	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
3	1	10	(ad lib)	f	\N	\N	2	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
4	1	8	(ad lib)	f	\N	\N	3	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
5	1	7	(ad lib) ... Ez! O, Patinetetxo bat. eta bi hegazkin	f	\N	\N	4	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
6	1	8	Ondo zaude, Mutil? Nork egin dizu hau? Usoa izan da? Utzi neuri! (ad lib) Bai, egin korrika! Hau da, hegalez!	f	\N	\N	5	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
7	1	7	Milesker, Txakur, baina ez nengoen patinetean, apurtu denean.	f	\N	\N	6	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
8	2	9	Eta zergatik daramazu kaskoa? 	f	\N	\N	0	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
9	2	7	Kalean barrena ibiltzea arriskutsua delako, edozer gerta liteke! Ondo zegoen lehen! Ez duzue ikusi zer jazo den?	f	\N	\N	1	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
10	3	15	O, ene Miranda.	f	\N	\N	0	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
11	3	11	Gazta! Mesedez, atera zaborra!	f	\N	\N	1	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
12	3	18	(ad lib)	f	\N	\N	2	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
13	3	15	(off) Maite dudan emakume bakarra zara.	f	\N	\N	3	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
14	3	18	(barrea)	f	\N	\N	4	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
15	4	18	E, ez, ez dakit zer gertatu den. Txakurrek esandako usoa izango zen.	f	\N	\N	0	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
16	4	3	Ez kezkatu, Mutil! Konponketen maisua naizenez, neuk konponduko dizut!	f	\N	\N	1	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
17	4	18	Zergatik? Patinete hori kaskarra zen! Bota eta erosi bat hobea! Eta txikiagoa. Gazta neurrikoa.	f	\N	\N	2	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
18	4	9	Egon, zergatik ez duzu eraldatzen? Saguk konpon dezala eta Gaztak apain dezala. Murriztu, berrerabili, birziklatu.	f	\N	\N	3	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
19	4	3	Interesgarria. Zer diozu, Gazta? Patinetea konpontzen badut, zu hura apaintzeko gauza izango zara?	f	\N	\N	4	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
20	5	18	(ad lib) Nik edozer apaindu dezaket! Mutil izan ezik. Ea ba, has gaitezen. Eraldatze taldea, aurrera! Bai!	f	\N	\N	0	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
21	5	7	(batera) Bai!	f	\N	\N	1	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
22	5	9	(batera)	f	\N	\N	2	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
23	5	8	(batera) eskerrikasko benetan	f	\N	\N	3	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
24	5	3	(batera) Zuri!	f	\N	\N	4	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
25	5	10	(batera) (ad lib)	f	\N	\N	5	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
26	5	7	Eraldatu! Zer da?	f	\N	\N	6	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
27	6	7	Uau! Normalean diseinu soilak gustatzen zaizkit, baina ohitu naiteke honetara.	f	\N	\N	0	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
28	6	9	Itzela da! Negozio bat ireki behar zenukete jendeari gauzak konpontzeko.	f	\N	\N	1	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
29	6	8	Ideia ona! Eta guk lagunduko dizuegu! Ez dugu ezer egin batera familia gisa... sekula!	f	\N	\N	2	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
30	6	9	E... Hori baino ez dugu egiten.	f	\N	\N	3	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
31	6	18	Aurrera! Arrakasta badugu azkenean gaztelu bat erosiko dut eta denok gonbidatuko zaituztet zerbitzari gisa.	f	\N	\N	4	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
32	7	3	Bueno, aste honetan aire-kutsadurarena konpondu nahi nuen, baina... ados!	f	\N	\N	0	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
33	8	18	Apurtutako zerbait duzue? Ba guk konponduko dizugu eta itxura hobetuko diogu! Eman izena orain eta lortu irabiaki bat doan. Irabiakiaren eskaintza agortu da.	f	\N	\N	0	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
34	8	8	Hau hautsita zegoen. Sinestezina, ezta?	f	\N	\N	1	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
35	8	13	(ad lib)	f	\N	\N	2	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
36	8	16	(ad lib)	f	\N	\N	3	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
37	8	10	(ad lib)	f	\N	\N	4	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
38	8	16	Uala! - Sinestezina! - (barrea) ... Aupa! - Aupa! - Bai!	f	\N	\N	5	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
39	8	13		f	\N	\N	6	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
40	8	5		f	\N	\N	7	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
41	8	19		f	\N	\N	8	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
42	8	6		f	\N	\N	9	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
43	9	18	Iufi, arrakasta izango dugu! freqfqef	f	\N	\N	0	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
44	9	3	O, benetan, Katu? Dagoeneko? 	f	\N	\N	1	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
45	9	10	(ad lib)	f	\N	\N	2	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
46	9	7	(ad lib)	f	\N	\N	3	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
47	9	8	(ad lib)	f	\N	\N	4	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
48	9	3	(ad lib)	f	\N	\N	5	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
49	10	10	(ad lib) 	f	\N	\N	0	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
50	10	3	(ad lib)	f	\N	\N	1	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
51	11	3	Mesedez! Ez hartu eskari gehiago. Nekatuta nago!	f	\N	\N	0	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
52	11	8	Baina, Sagu, jendeari laguntzea itzela da!	f	\N	\N	1	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
53	11	9	Gainera, Gazta lanpetuta dagoenez, ez dabil harrokeriatan. Nekatuta bazaude, egin kuluxka bat.	f	\N	\N	2	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
54	11	3	Saiatzen naizen bakoitzean, esnatu egiten nauzue! Gauza gehiegi dugu konpontzeko eta denbora gutxiegi! Eta begira Mutili!	f	\N	\N	3	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
55	11	7	(ad lib)	f	\N	\N	4	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
56	11	10	(ad lib)	f	\N	\N	5	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
57	12	18	Lasai! Gainera, birziklatzeak Lurraren berotzea konpontzen laguntzen du. Edo Lurra gorroto duzu? E? Hara, Sagu, gehiegi bada, egin konponketa errazak. Kolaz itsatsi eta kito!	f	\N	\N	0	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
58	12	3	Uaaa. Ez, ez. Lehenik hidroteknologiaz altzairua urtu behar da, gero lotura-eragile bat asmatu behar dut hori...	f	\N	\N	1	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
59	12	18	(ad lib) Ez! Kola! Nik esandakoa! Itzel! Konponduta! Lanera!	f	\N	\N	2	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
60	13	3	Ez. Gauza hauek behar bezala konpondu behar dira. Eta lo egiten ez badut, ezin dut ezer konpondu!	f	\N	\N	0	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
61	13	7	(ad lib) Saguk arrazoi du! Bihar jarraituko dugu. Ai ama! Irrikan nago nire ohetxo goxo, eroso, leunera joateko eta han barruan goxo-goxo uzkurtu eta... (ad lib)	f	\N	\N	1	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
62	13	3	(batera) (ad lib)	f	\N	\N	2	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
63	14	10	(ad lib)	f	\N	\N	0	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
64	14	3	A! Fresko-fresko eta poz-pozik sentitzen naiz! Ezerk ez nau haserretuko eta... Ezin dut sinetsi!	f	\N	\N	1	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
65	14	7	Oraindik eskariak onartzen? Atzo garbi esan genuen ba. Gauza gehiegi dugu konpontzeko jada!	f	\N	\N	2	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
66	14	9	Lasai! Bart ia eskari guztiez arduratu ginen, pare bat baino ez da geratzen.	f	\N	\N	3	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
67	14	3	Baina nola konpondu zenuten hainbeste gauza hain azkar? Eta ni gabe?	f	\N	\N	4	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
68	15	18	Katu eta Txakur arduratu dira denaz. Eta ez dira zuek bezainbeste kexatu. Gauzak konpontzea ez da hain zaila.	f	\N	\N	0	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
69	15	3	(ad lib) Horri esaten diozue konpontzea? Ez dakit zer daukadan aurrean ere! Aski da! Ez dut onartuko nire izena negozio axolagabe bati lotuta egotea. Utzi egiten dut!	f	\N	\N	1	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
70	15	7	Nik ere bai!	f	\N	\N	2	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
71	16	2	Kaixo! Nire etxezainak zuen zerbitzua aipatu dit eta txundituta nago! Ez nekien hautsitako gauzak konpondu daitezkenik! Nire lanpara konpon dezakezue? Festa bat dut gaur gauean eta gonbidatuak txunditu behar ditut.	f	\N	\N	0	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
72	16	9	Ordubete barru izango duzu! Gauza zarete!	f	\N	\N	1	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
73	16	8	(batera) (ad lib)	f	\N	\N	2	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
74	16	10	(ad lib)	f	\N	\N	3	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
75	16	8	Ondo dagoela uste duzu?	f	\N	\N	4	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
76	17	10	(ad lib)	f	\N	\N	0	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
77	17	13	A, nire ipotxa! Nork babestuko dit etxea orain? Konpondu duzuela esan didazue!	f	\N	\N	1	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
78	17	18	Ez kezkatu, berriro konponduko dut! Txakur, konpondu berriro.	f	\N	\N	2	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
79	17	9	E, aizue? Ez ote ditugu gauzak azkarregi konpondu?	f	\N	\N	3	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
80	17	18	Ez! Ez dut uste.	f	\N	\N	4	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
81	17	1	(off) Nire mahaia!	f	\N	\N	5	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
82	17	17	(off) Nire irrati-kasetea!	f	\N	\N	6	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
83	17	4	(off) (ad lib)	f	\N	\N	7	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
84	18	18	Bueno, agian azkarregi konpondu ditugu.	f	\N	\N	0	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
85	18	9	Konpondutako gauzak berreskuratu behar ditugu. Orain!	f	\N	\N	1	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
86	19	18	Hauxe da dena! Txakur, konpon itzazu ondo eta eraman Saguk ikusi baino lehen.	f	\N	\N	0	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
87	19	8	E, ezin ditut konpondu. Sagu da aditua, gogoratzen?	f	\N	\N	1	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
88	19	9	Armairua, eginda. Pufa, eginda. E, aizue, Burlington andrearen lanpara ahaztu zaizue.	f	\N	\N	2	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
89	19	8	Ez zaigu ahaztu lanpara! Zer uste duzu... Ba bai, ahaztu egin zaigu.	f	\N	\N	3	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
90	19	18	O, ez! Bere festa hastera doa! Lanpara jaitsi behar dugu sabaitik erori baino lehen!	f	\N	\N	4	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
91	20	3	Zer? Lanpara bat erori egingo da festa batean zuen konponketaren erruz?	f	\N	\N	0	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
92	20	18	Bai! Baina utzi liskarrak orain. Lagundu, mesedez! 	f	\N	\N	1	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
93	20	7	Bueno, bai, noski! Goazen!	f	\N	\N	2	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
94	20	10	(ad lib)	f	\N	\N	3	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
95	20	8	Goazen, Katu!	f	\N	\N	4	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
96	21	12	Egon, nora zoazte?	f	\N	\N	0	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
97	21	18	Arin! Lanpara hautsi eta lurrera eroriko da!	f	\N	\N	1	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
98	21	12	(ad lib) Etxezain baten lehen araua hau da: inoiz ez sinetsi esneki hiztun bati. Ospa! Ez zaude zerrendan.	f	\N	\N	2	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
99	21	10	(ad lib)	f	\N	\N	3	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
100	21	12	(ad lib) Katu! Zu bai, zerrendan zaude. Sartu!	f	\N	\N	4	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
101	21	3	Badakizu zer egin, Katu!	f	\N	\N	5	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
102	21	10	(ad lib)	f	\N	\N	6	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
103	22	10	(ad lib)	f	\N	\N	0	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
104	22	2	Nork nahi du mokadu fin bat?	f	\N	\N	1	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
105	22	10	(ad lib)	f	\N	\N	2	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
106	22	3	A, putza, horra sartu eta mundu guztia atera beharko dugu. Baina nola engainatuko dugu etxezaina?	f	\N	\N	3	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
107	22	8	Utzi neuri! Plan bikain bat daukat, oso argia, oso konplexua, etxezaina zur eta lur utziko duena.	f	\N	\N	4	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
108	23	8	E! Etxezaina! Kiratsa darizu! (ad lib) (barrea)	f	\N	\N	0	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
109	23	12	(ad lib) Ez darit kiratsik! Ospa hemendik, aizu!	f	\N	\N	1	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
110	23	2	Zer egiten duzue hemen, gazteak?	f	\N	\N	2	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
111	23	7	E... Printze batek bidali gaitu. Bartington? Bai, hona etorri da bizitzera eta zuen zain dago kanpoan.	f	\N	\N	3	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
112	24	2	(ad lib) Bartington printzea? Ez dut ezagutzen.	f	\N	\N	0	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
113	24	18	E, aberatsa da.	f	\N	\N	1	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
114	24	2	A, bai, Bartington printzea! Goazen, gonbidatuak.	f	\N	\N	2	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
115	24	10	(ad lib)	f	\N	\N	3	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
116	24	7	(ad lib)	f	\N	\N	4	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
117	24	9		f	\N	\N	5	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
118	24	8		f	\N	\N	6	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
119	24	3		f	\N	\N	7	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
120	24	18		f	\N	\N	8	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
121	24	10	(ad lib)	f	\N	\N	9	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
122	24	7	(ad lib)	f	\N	\N	10	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
123	24	9		f	\N	\N	11	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
124	24	8		f	\N	\N	12	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
125	24	3		f	\N	\N	13	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
126	25	18	(batera) (ad lib) (ad lib) Sagu, arrazoi duzu, konponketaren zatia apaintzearena bezain garrantzitsua da. Sentitzen dut.	f	\N	\N	0	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
127	25	9	Bai, eta familia gisa zerbait egitea itzela den arren, hurrengoan elkarri entzun behar diogu. (ad lib)	f	\N	\N	1	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
128	25	7	(batera) (ad lib)	f	\N	\N	2	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
129	25	18	(batera) (ad lib)	f	\N	\N	3	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
130	25	8	(batera) (ad lib)	f	\N	\N	4	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
131	25	10	(batera) (ad lib)	f	\N	\N	5	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
132	25	3	(batera) (ad lib)	f	\N	\N	6	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
133	25	2	Ai ene! Nire lanpara guztien artean hauxe zen nire hamalaugarren kutuna.	f	\N	\N	7	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
134	25	18	Burlington andrea. Ez dugu ondo konpondu eta asko, asko sentitzen dugu.	f	\N	\N	8	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
135	26	2	Mmm, denok egiten ditugu akatsak eta lezioa ikasi baduzue, zuen barka onartzen dut. Orain, zuen baimenarekin, komunera joan behar dut. ... (ad lib)	f	\N	\N	0	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00	\N
\.


--
-- Data for Name: personajes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.personajes (id, nombre_personaje, actor_doblaje, fecha_creacion, fecha_actualizacion) FROM stdin;
1	UNCLE BUB	\N	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
2	BURLINGTON	\N	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
3	MOUSE	\N	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
4	CHARLOTTE	\N	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
5	MUTIL 2	\N	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
6	NESKA 1	\N	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
7	BOY	\N	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
8	DOG	\N	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
9	GIRL	\N	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
10	CAT	\N	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
11	MOM	\N	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
12	BUTLER	\N	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
13	OLD LADY MCGUIRE	\N	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
14	IZENBURUA	\N	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
15	TV MAN	\N	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
16	MUTIL 1	\N	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
17	RIPPED ABMAN	\N	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
18	CHEESE	\N	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
19	TXAKUR MARROIA	\N	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
\.


--
-- Data for Name: series; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.series (id, numero_referencia, nombre_serie, fecha_creacion, fecha_actualizacion) FROM stdin;
1	111111	Prueba	2025-05-05 10:56:06.417068+00	2025-05-05 10:56:06.417068+00
3	220308	BOY GIRL DOG CAT MOUSE CHEESE S.2	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
\.


--
-- Data for Name: takes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.takes (id, capitulo_id, numero_take, tc_in, tc_out, fecha_creacion, fecha_actualizacion) FROM stdin;
1	1	1	00:00:21:06	00:00:50:02	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
2	1	2	00:00:50:02	00:01:03:23	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
3	1	3	00:01:04:20	00:01:23:13	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
4	1	4	00:01:24:03	00:01:54:21	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
5	1	5	00:01:55:11	00:02:07:10	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
6	1	6	00:02:07:10	00:02:35:21	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
7	1	7	00:02:35:21	00:02:42:09	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
8	1	8	00:02:45:02	00:03:13:24	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
9	1	9	00:03:13:24	00:03:41:20	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
10	1	10	00:03:41:20	00:03:53:04	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
11	1	11	00:03:56:20	00:04:23:12	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
12	1	12	00:04:23:12	00:04:50:08	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
13	1	13	00:04:50:08	00:05:20:01	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
14	1	14	00:05:20:01	00:05:50:00	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
15	1	15	00:05:50:00	00:06:17:23	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
16	1	16	00:06:19:05	00:06:49:13	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
17	1	17	00:06:51:05	00:07:20:13	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
18	1	18	00:07:21:04	00:07:28:11	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
19	1	19	00:07:28:11	00:07:57:21	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
20	1	20	00:07:57:21	00:08:16:10	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
21	1	21	00:08:19:00	00:08:46:02	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
22	1	22	00:08:47:09	00:09:11:14	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
23	1	23	00:09:12:03	00:09:41:21	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
24	1	24	00:09:43:10	00:10:08:24	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
25	1	25	00:10:08:24	00:10:35:23	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
26	1	26	00:10:35:23	00:10:56:06	2025-05-05 13:22:14.30056+00	2025-05-05 13:22:14.30056+00
\.


--
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.usuarios (id, nombre, password_hash, fecha_creacion, fecha_actualizacion) FROM stdin;
1	testuser	$2b$12$CGaECPm96SdgD9Xmzqj2GevJh/Yk7nhGdKgepB5AUFkQP499HuDNu	2025-04-30 11:52:09.24173+00	2025-04-30 11:52:09.24173+00
3	admin	$2b$12$3vdC7UIsMQdYwK7UcsR01eqGARsWWpAjqXVYWr.ZAOGX47dxWYxka	2025-05-05 10:40:33.305287+00	2025-05-05 10:40:33.305287+00
4	User	$2b$12$6d1.Hnse/eQknRlQnArbcu6dRdzWzzQsHz1rrxCDyvYDwc0.jC9RW	2025-05-05 13:21:46.150525+00	2025-05-05 13:21:46.150525+00
\.


--
-- Name: capitulos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.capitulos_id_seq', 1, true);


--
-- Name: intervenciones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.intervenciones_id_seq', 135, true);


--
-- Name: personajes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.personajes_id_seq', 19, true);


--
-- Name: series_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.series_id_seq', 3, true);


--
-- Name: takes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.takes_id_seq', 26, true);


--
-- Name: usuarios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.usuarios_id_seq', 4, true);


--
-- Name: capitulos capitulos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capitulos
    ADD CONSTRAINT capitulos_pkey PRIMARY KEY (id);


--
-- Name: capitulos capitulos_serie_id_numero_capitulo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capitulos
    ADD CONSTRAINT capitulos_serie_id_numero_capitulo_key UNIQUE (serie_id, numero_capitulo);


--
-- Name: intervenciones intervenciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intervenciones
    ADD CONSTRAINT intervenciones_pkey PRIMARY KEY (id);


--
-- Name: personajes personajes_nombre_personaje_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personajes
    ADD CONSTRAINT personajes_nombre_personaje_key UNIQUE (nombre_personaje);


--
-- Name: personajes personajes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personajes
    ADD CONSTRAINT personajes_pkey PRIMARY KEY (id);


--
-- Name: series series_numero_referencia_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series
    ADD CONSTRAINT series_numero_referencia_key UNIQUE (numero_referencia);


--
-- Name: series series_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series
    ADD CONSTRAINT series_pkey PRIMARY KEY (id);


--
-- Name: takes takes_capitulo_id_numero_take_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.takes
    ADD CONSTRAINT takes_capitulo_id_numero_take_key UNIQUE (capitulo_id, numero_take);


--
-- Name: takes takes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.takes
    ADD CONSTRAINT takes_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_nombre_key UNIQUE (nombre);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: idx_capitulos_serie_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_capitulos_serie_id ON public.capitulos USING btree (serie_id);


--
-- Name: idx_intervenciones_personaje_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intervenciones_personaje_id ON public.intervenciones USING btree (personaje_id);


--
-- Name: idx_intervenciones_take_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intervenciones_take_id ON public.intervenciones USING btree (take_id);


--
-- Name: idx_intervenciones_usuario_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intervenciones_usuario_id ON public.intervenciones USING btree (usuario_id);


--
-- Name: idx_takes_capitulo_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_takes_capitulo_id ON public.takes USING btree (capitulo_id);


--
-- Name: capitulos set_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.capitulos FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: intervenciones set_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.intervenciones FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: personajes set_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.personajes FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: series set_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.series FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: takes set_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.takes FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: usuarios set_timestamp_usuarios; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_timestamp_usuarios BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: capitulos capitulos_serie_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capitulos
    ADD CONSTRAINT capitulos_serie_id_fkey FOREIGN KEY (serie_id) REFERENCES public.series(id) ON DELETE CASCADE;


--
-- Name: intervenciones fk_intervenciones_usuario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intervenciones
    ADD CONSTRAINT fk_intervenciones_usuario FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: intervenciones intervenciones_personaje_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intervenciones
    ADD CONSTRAINT intervenciones_personaje_id_fkey FOREIGN KEY (personaje_id) REFERENCES public.personajes(id) ON DELETE RESTRICT;


--
-- Name: intervenciones intervenciones_take_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intervenciones
    ADD CONSTRAINT intervenciones_take_id_fkey FOREIGN KEY (take_id) REFERENCES public.takes(id) ON DELETE CASCADE;


--
-- Name: takes takes_capitulo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.takes
    ADD CONSTRAINT takes_capitulo_id_fkey FOREIGN KEY (capitulo_id) REFERENCES public.capitulos(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

