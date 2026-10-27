--
-- PostgreSQL database dump
--

\restrict fqUIAZvDj1BFqwRxrv1QY6WG00SaWgtiN2wuVFMCRb4Mkhwh2TaMLEcDsItCK2Z

-- Dumped from database version 16.15 (Homebrew)
-- Dumped by pg_dump version 16.15 (Homebrew)

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    id integer NOT NULL,
    level text DEFAULT 'info'::text NOT NULL,
    action text NOT NULL,
    message text NOT NULL,
    customer_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT activity_logs_level_check CHECK ((level = ANY (ARRAY['info'::text, 'success'::text, 'warning'::text, 'error'::text])))
);


--
-- Name: activity_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.activity_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: activity_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.activity_logs_id_seq OWNED BY public.activity_logs.id;


--
-- Name: admins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admins (
    id integer NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admins_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admins_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admins_id_seq OWNED BY public.admins.id;


--
-- Name: customer_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id integer NOT NULL,
    code text DEFAULT ('PLG'::text || lpad((nextval('public.customer_code_seq'::regclass))::text, 4, '0'::text)) NOT NULL,
    name text NOT NULL,
    phone text,
    address text,
    pppoe_username text NOT NULL,
    pppoe_password text NOT NULL,
    package_id integer NOT NULL,
    active_date date NOT NULL,
    due_day smallint NOT NULL,
    isolir_day smallint NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    billing_type text DEFAULT 'prepaid'::text NOT NULL,
    CONSTRAINT customers_billing_type_check CHECK ((billing_type = ANY (ARRAY['prepaid'::text, 'postpaid'::text]))),
    CONSTRAINT customers_due_day_check CHECK (((due_day >= 1) AND (due_day <= 31))),
    CONSTRAINT customers_isolir_day_check CHECK (((isolir_day >= 1) AND (isolir_day <= 31))),
    CONSTRAINT customers_status_check CHECK ((status = ANY (ARRAY['active'::text, 'isolated'::text, 'inactive'::text])))
);


--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id integer NOT NULL,
    number text NOT NULL,
    customer_id integer NOT NULL,
    period date NOT NULL,
    package_name text NOT NULL,
    amount integer NOT NULL,
    issue_date date NOT NULL,
    due_date date NOT NULL,
    isolir_date date NOT NULL,
    status text DEFAULT 'unpaid'::text NOT NULL,
    paid_at timestamp with time zone,
    payment_method text,
    paid_by integer,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT invoices_amount_check CHECK ((amount >= 0)),
    CONSTRAINT invoices_status_check CHECK ((status = ANY (ARRAY['unpaid'::text, 'paid'::text, 'void'::text])))
);


--
-- Name: invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invoices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invoices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.invoices_id_seq OWNED BY public.invoices.id;


--
-- Name: packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.packages (
    id integer NOT NULL,
    name text NOT NULL,
    price integer NOT NULL,
    mikrotik_profile text NOT NULL,
    speed text,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT packages_price_check CHECK ((price >= 0))
);


--
-- Name: packages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.packages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: packages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.packages_id_seq OWNED BY public.packages.id;


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    key text NOT NULL,
    value text DEFAULT ''::text NOT NULL
);


--
-- Name: activity_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs ALTER COLUMN id SET DEFAULT nextval('public.activity_logs_id_seq'::regclass);


--
-- Name: admins id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admins ALTER COLUMN id SET DEFAULT nextval('public.admins_id_seq'::regclass);


--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- Name: invoices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices ALTER COLUMN id SET DEFAULT nextval('public.invoices_id_seq'::regclass);


--
-- Name: packages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packages ALTER COLUMN id SET DEFAULT nextval('public.packages_id_seq'::regclass);


--
-- Data for Name: activity_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.activity_logs (id, level, action, message, customer_id, created_at) FROM stdin;
1	info	auth.login	Admin admin login	\N	2026-10-26 18:44:30.372373+07
3	info	cycle	Siklus billing (api/cron): 0 invoice baru, 1 diisolir, 0 dibuka, 0 gagal	\N	2026-10-26 19:05:01.76095+07
4	info	auth.login	Admin admin login	\N	2026-10-26 19:41:10.045283+07
5	info	settings.company	Pengaturan usaha & billing disimpan	\N	2026-10-26 19:45:35.656723+07
6	info	settings.company	Pengaturan usaha & billing disimpan	\N	2026-10-26 19:45:42.100326+07
7	info	settings.company	Pengaturan usaha & billing disimpan	\N	2026-10-26 19:45:50.581462+07
2	warning	isolir	Ahmad Fauzi (Warkop Net) ditandai terisolir (MikroTik nonaktif). Tunggakan: INV-202610-PLG0003	\N	2026-10-26 19:05:01.753613+07
8	success	invoice.paid	Invoice INV-202610-PLG0003 dibayar (Cash)	\N	2026-10-26 20:27:10.280754+07
9	success	restore	Ahmad Fauzi (Warkop Net) diaktifkan kembali (MikroTik nonaktif). Pembayaran INV-202610-PLG0003	\N	2026-10-26 20:27:10.409268+07
12	warning	customer.delete	Pelanggan PLG0003 - Ahmad Fauzi (Warkop Net) dihapus	\N	2026-10-26 23:11:35.703369+07
10	success	invoice.paid	Invoice INV-202610-PLG0002 dibayar (Cash)	\N	2026-10-26 20:27:27.588932+07
11	success	restore	Siti Aminah diaktifkan kembali (MikroTik nonaktif). Pembayaran INV-202610-PLG0002	\N	2026-10-26 20:27:27.985985+07
13	warning	customer.delete	Pelanggan PLG0002 - Siti Aminah dihapus	\N	2026-10-26 23:11:37.667287+07
14	warning	customer.delete	Pelanggan PLG0001 - Budi Santoso dihapus	\N	2026-10-26 23:11:39.490489+07
\.


--
-- Data for Name: admins; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.admins (id, username, password_hash, name, created_at) FROM stdin;
1	admin	$2b$10$yp2mf29AlOTrrQXXA4BoDO9Aw46EloTnHbL0qLqQBcxUWEwg24ccu	Administrator	2026-10-26 16:20:13.792113+07
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.customers (id, code, name, phone, address, pppoe_username, pppoe_password, package_id, active_date, due_day, isolir_day, status, notes, created_at, updated_at, billing_type) FROM stdin;
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.invoices (id, number, customer_id, period, package_name, amount, issue_date, due_date, isolir_date, status, paid_at, payment_method, paid_by, notes, created_at) FROM stdin;
\.


--
-- Data for Name: packages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.packages (id, name, price, mikrotik_profile, speed, description, created_at) FROM stdin;
1	Home 10 Mbps	150000	HOME-10M	10 Mbps	Paket rumahan basic	2026-10-26 16:20:13.792113+07
2	Home 20 Mbps	200000	HOME-20M	20 Mbps	Paket rumahan standar	2026-10-26 16:20:13.792113+07
3	Home 50 Mbps	300000	HOME-50M	50 Mbps	Paket rumahan premium	2026-10-26 16:20:13.792113+07
\.


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.settings (key, value) FROM stdin;
mikrotik_enabled	false
mikrotik_host	
mikrotik_port	8728
mikrotik_tls	false
mikrotik_user	
mikrotik_password	
isolir_profile	ISOLIR
timezone	Asia/Jakarta
last_cycle_at	2026-10-26T22:58:51.274Z
last_cycle_summary	0 invoice baru, 0 diisolir, 0 dibuka, 0 gagal
company_name	James.NET
company_phone	+62 818-0683-1996
company_address	Jl. Contoh No. 1, Kota Anda
bank_info	Pembayaran : \r\nBCA : 7130739045  - Lois Noel\r\nDANA :
invoice_days_before	7
auto_isolir	true
\.


--
-- Name: activity_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.activity_logs_id_seq', 14, true);


--
-- Name: admins_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.admins_id_seq', 1, true);


--
-- Name: customer_code_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.customer_code_seq', 3, true);


--
-- Name: customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.customers_id_seq', 3, true);


--
-- Name: invoices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.invoices_id_seq', 66, true);


--
-- Name: packages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.packages_id_seq', 3, true);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (id);


--
-- Name: admins admins_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_username_key UNIQUE (username);


--
-- Name: customers customers_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_code_key UNIQUE (code);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pppoe_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pppoe_username_key UNIQUE (pppoe_username);


--
-- Name: invoices invoices_customer_id_period_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_customer_id_period_key UNIQUE (customer_id, period);


--
-- Name: invoices invoices_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_number_key UNIQUE (number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: packages packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packages
    ADD CONSTRAINT packages_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (key);


--
-- Name: activity_logs_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_logs_created_idx ON public.activity_logs USING btree (created_at DESC);


--
-- Name: customers_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customers_status_idx ON public.customers USING btree (status);


--
-- Name: invoices_period_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoices_period_idx ON public.invoices USING btree (period);


--
-- Name: invoices_status_isolir_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoices_status_isolir_idx ON public.invoices USING btree (status, isolir_date);


--
-- Name: activity_logs activity_logs_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: customers customers_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.packages(id) ON DELETE RESTRICT;


--
-- Name: invoices invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_paid_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_paid_by_fkey FOREIGN KEY (paid_by) REFERENCES public.admins(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict fqUIAZvDj1BFqwRxrv1QY6WG00SaWgtiN2wuVFMCRb4Mkhwh2TaMLEcDsItCK2Z

