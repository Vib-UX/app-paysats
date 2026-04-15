const id = {
  // Auth screen
  "auth.tagline": "Simpan ke dalam",
  "auth.taglineHighlight": "BTC Pockets",
  "auth.subtitle":
    "Buat tujuan tabungan dan investasi otomatis ke Bitcoin. Arka x IDRX memungkinkan deposit IDR langsung. Mulai dari Rp 25.000.",
  "auth.pill.savings": "Tabungan",
  "auth.pill.dca": "Auto DCA",
  "auth.pill.directIdr": "Deposit IDR Langsung",
  "auth.continueGoogle": "Lanjutkan dengan Google",
  "auth.connecting": "Menghubungkan…",
  "auth.loginFailed": "Login gagal. Coba lagi atau periksa koneksi.",
  "auth.riskDisclaimer":
    "Investasi aset kripto mengandung risiko pasar. Dengan melanjutkan, kamu menyetujui",
  "auth.termsOfService": "Ketentuan Layanan",
  "auth.and": "dan",
  "auth.privacyPolicy": "Kebijakan Privasi",
  "auth.loading": "Memuat…",
  "auth.settingUp": "Menyiapkan akun kamu…",

  // Nav
  "nav.home": "Beranda",
  "nav.dca": "DCA",
  "nav.deposit": "Deposit",
  "nav.profile": "Profil",

  // Dashboard
  "dashboard.balanceIdrx": "Saldo IDRX",
  "dashboard.balanceBtc": "Saldo cbBTC (sats)",
  "dashboard.loadingWallet": "Memuat dompet…",
  "dashboard.loading": "Memuat…",
  "dashboard.walletNotDetected":
    "Dompet Privy belum terdeteksi. Buka Profil atau tunggu sinkronisasi.",
  "dashboard.copy": "Salin",
  "dashboard.copied": "Disalin",
  "dashboard.depositIdr": "Deposit IDR → IDRX",
  "dashboard.depositDesc":
    "Tukar rupiah ke IDRX dan mulai investasi pertamamu.",
  "dashboard.depositBtn": "Deposit",
  "dashboard.startInvesting": "Mulai Investasi",
  "dashboard.startInvestingDesc":
    "Deposit IDR ke dompet Arka kamu, lalu atur DCA otomatis ke Bitcoin. Mulai dari nominal kecil.",
  "dashboard.loadIdr": "Top-up IDR ke IDRX",
  "dashboard.loadIdrDesc":
    "Tukar rupiah ke IDRX dan mulai berinvestasi.",
  "dashboard.loadIdrBtn": "Top-up Sekarang",
  "dashboard.savings": "Tabungan kamu",
  "dashboard.viewAll": "Lihat semua",
  "dashboard.dcaActive": "DCA Aktif",
  "dashboard.dcaAutoTitle": "DCA otomatis IDRX → cbBTC",
  "dashboard.dcaAutoDesc":
    "Jadwalkan pembelian Bitcoin otomatis dari saldo IDRX kamu.",
  "dashboard.recentActivity": "Aktivitas deposit",
  "dashboard.failedLoadBalance": "Gagal memuat saldo",
  "dashboard.failedLoadBtc":
    "Gagal membaca saldo cbBTC — periksa RPC dan alamat kontrak.",
  "dashboard.unlimitedSwaps": "tanpa batas",
  "dashboard.setBtcEnv":
    "Set NEXT_PUBLIC_BTC_ERC20_ADDRESS ke cbBTC Base (satu alamat, 42 karakter).",

  // DCA
  "dca.title": "DCA otomatis",
  "dca.checkingOrder": "Memeriksa order aktif…",
  "dca.cannotRead": "Tidak bisa membaca status DCA dari kontrak.",
  "dca.subtitleActive":
    "Chainlink Automation mengeksekusi swap IDRX → cbBTC sesuai jadwal.",
  "dca.subtitleNew":
    "Jadwalkan pembelian cbBTC otomatis dari saldo IDRX kamu. Setelah order dibuat, Chainlink Automation mengeksekusi tanpa perlu aksi tambahan.",
  "dca.active": "DCA Aktif",
  "dca.perSwap": "Per swap",
  "dca.frequency": "Frekuensi",
  "dca.executions": "Eksekusi",
  "dca.next": "Berikutnya",
  "dca.minOutput": "Min. output",
  "dca.unlimited": "Tanpa batas",
  "dca.soon": "Segera",
  "dca.waitingKeeper": "Menunggu keeper…",
  "dca.cancelConfirm":
    "Yakin ingin membatalkan DCA? Sisa IDRX tetap di dompet kamu.",
  "dca.cancelling": "Membatalkan…",
  "dca.cancelYes": "Ya, batalkan",
  "dca.cancelBack": "Kembali",
  "dca.cancelBtn": "Batalkan DCA",
  "dca.swapHistory": "Riwayat swap",
  "dca.noSwapsYet":
    "Belum ada swap yang dieksekusi. Chainlink Automation akan menjalankan swap pertama sesuai jadwal.",
  "dca.totalIdrx": "Total IDRX",
  "dca.totalBtc": "Total cbBTC",

  // DCA Form
  "dca.form.amountLabel": "Nominal per swap (IDR)",
  "dca.form.amountPlaceholder": "Contoh: 50000",
  "dca.form.amountHint": "Jumlah IDRX yang di-swap ke cbBTC setiap eksekusi.",
  "dca.form.frequencyLabel": "Frekuensi",
  "dca.form.swapsLabel": "Jumlah eksekusi",
  "dca.form.swapsPlaceholder": "0 = tanpa batas",
  "dca.form.swapsHint":
    "Kosongkan atau isi 0 untuk DCA tanpa batas (bisa dibatalkan kapan saja).",
  "dca.form.info":
    "Satu konfirmasi: approve IDRX + buat order DCA dalam satu transaksi. Setelah selesai, Chainlink Automation mengeksekusi swap otomatis.",
  "dca.form.submit": "Mulai DCA",
  "dca.form.submitting": "Mengirim transaksi…",
  "dca.form.success": "Order DCA berhasil dibuat!",
  "dca.form.successHint":
    "Chainlink Automation akan mengeksekusi swap secara otomatis sesuai jadwal. Tidak perlu aksi tambahan.",
  "dca.form.viewBasescan": "Lihat di Basescan",
  "dca.form.errorAmount": "Masukkan nominal per swap (min. Rp 1)",
  "dca.form.errorSwaps": "Jumlah swap harus angka bulat (0 = tanpa batas)",

  // DCA Smart Wallet
  "dca.smartWallet": "Smart wallet",
  "dca.smartBalance": "Saldo IDRX",
  "dca.smartLoading": "Memuat…",

  // DCA Interval labels
  "dca.interval.daily": "Harian",
  "dca.interval.weekly": "Mingguan",
  "dca.interval.monthly": "Bulanan",
  "dca.interval.minutes": "menit",
  "dca.interval.hours": "jam",
  "dca.interval.days": "hari",

  // Mint
  "mint.title": "Mint IDRX",
  "mint.subtitle":
    "Tukar rupiah menjadi IDRX ke dompet Arka kamu. Setelah permintaan dibuat, kamu akan diarahkan ke halaman pembayaran mitra.",
  "mint.checkingIdrx": "Memeriksa status IDRX…",
  "mint.linkingIdrx": "Menghubungkan akun IDRX (email Privy)…",
  "mint.linkingWait": "Satu saat lagi…",
  "mint.preparing": "Menyiapkan mint…",
  "mint.errorTitle": "Tidak bisa menyiapkan IDRX. Coba lagi.",
  "mint.errorDefault":
    "Gagal memeriksa atau menghubungkan onboarding. Periksa jaringan lalu muat ulang halaman.",
  "mint.destLabel": "Dompet tujuan (Arka)",
  "mint.destWaiting": "Menunggu dompet…",
  "mint.amountLabel": "Nominal IDRX (IDR)",
  "mint.amountPlaceholder": "Min. Rp 20.000",
  "mint.amountHint":
    "Minimum Rp 20.000 sesuai ketentuan IDRX. Nominal bayar bisa sedikit berbeda setelah biaya.",
  "mint.networkLabel": "Jaringan",
  "mint.networkHint":
    "Base dipilih sebagai default untuk ekspansi produk ke depan.",
  "mint.expiryLabel": "Batas waktu pembayaran",
  "mint.resultTitle":
    "Permintaan dibuat. Lanjutkan pembayaran untuk menyelesaikan mint.",
  "mint.resultTotalPay": "Total bayar",
  "mint.resultReference": "Referensi",
  "mint.resultOrder": "Order",
  "mint.resultPayBtn": "Lanjut ke pembayaran",
  "mint.resultActivityLink": "Aktivitas",
  "mint.resultTrackPrefix": "Pantau status di",
  "mint.resultTrackSuffix": "setelah membayar — verifikasi dari API transaksi IDRX.",
  "mint.submit": "Buat permintaan mint",
  "mint.submitting": "Memproses…",
  "mint.errorNoWallet": "Dompet belum tersedia",
  "mint.errorNoAmount": "Masukkan nominal",
  "mint.errorGeneric": "Permintaan gagal",
  "mint.processingNotice":
    "Setelah pembayaran dikonfirmasi, IDRX membutuhkan 1–2 menit untuk muncul di dompet kamu.",

  // Activity
  "activity.title": "Aktivitas",
  "activity.subtitle":
    "Riwayat deposit & mint IDRX: status pembayaran dan mint dari API mitra. Saldo IDRX/BTC di dompet dibaca on-chain dari Beranda.",
  "activity.reload": "Muat ulang",
  "activity.failedLoad": "Gagal memuat",

  // Transaction list
  "tx.empty":
    "Belum ada transaksi mint. Setelah kamu membuat permintaan, statusnya muncul di sini.",
  "tx.amountIdrx": "Jumlah IDRX",
  "tx.payIdr": "Bayar (IDR)",
  "tx.destWallet": "Dompet tujuan",
  "tx.reference": "Referensi",
  "tx.merchantOrder": "Merchant order",
  "tx.createdAt": "Dibuat",
  "tx.txHash": "Tx hash",

  // Transaction statuses
  "tx.status.waitingPayment": "Menunggu pembayaran",
  "tx.status.expired": "Kedaluwarsa",
  "tx.status.failed": "Gagal",
  "tx.status.paid": "Dibayar",
  "tx.status.minted": "Sudah di-mint",
  "tx.status.processing": "Diproses",
  "tx.status.approved": "Disetujui",
  "tx.status.mintFailed": "Gagal mint",
  "tx.status.waiting": "Menunggu",

  // Profile
  "profile.title": "Profil",
  "profile.subtitle":
    "Akun Arka dan dompet Privy kamu. Informasi sensitif mitra (IDRX) hanya disimpan terenkripsi di server.",
  "profile.name": "Nama",
  "profile.email": "Email",
  "profile.wallet": "Dompet Arka",
  "profile.onboarding": "Onboarding IDRX",
  "profile.onboardingDone": "Selesai",
  "profile.onboardingPending": "Belum selesai",
  "profile.logout": "Keluar",
  "profile.loadError": "Gagal memuat profil",
  "profile.retry": "Coba lagi",

  // Savings
  "savings.title": "Tabungan",
  "savings.subtitle":
    "Kelola tujuan tabungan dan alokasi BTC kamu. Data sungguhan akan terhubung ke dompet Privy di rilis berikutnya.",
  "savings.empty":
    "Belum ada tabungan yang disimpan. Mulai dari Beranda dengan deposit IDRX, lalu atur alokasi per tujuan ketika fitur ini siap.",

  // Onboarding
  "onboarding.title": "IDRX",
  "onboarding.subtitle":
    "Akun mitra dihubungkan otomatis saat kamu membuka Mint — memakai email dari Privy, tanpa unggah KYC di sini.",
  "onboarding.desc":
    "Buka halaman Mint untuk menyelesaikan penautan IDRX di latar belakang dan membuat permintaan IDRX.",
  "onboarding.goDeposit": "Ke Deposit",

  // Expiry presets
  "expiry.1h": "1 jam",
  "expiry.6h": "6 jam",
  "expiry.24h": "24 jam",

  // General
  "general.failedLoad": "Gagal memuat",
} as const;

const en: Record<keyof typeof id, string> = {
  // Auth screen
  "auth.tagline": "Save into",
  "auth.taglineHighlight": "BTC Pockets",
  "auth.subtitle":
    "Create savings goals and auto-invest into Bitcoin. Arka x IDRX allows direct IDR deposits. Start with as little as Rp 25,000.",
  "auth.pill.savings": "Savings",
  "auth.pill.dca": "Auto DCA",
  "auth.pill.directIdr": "Direct IDR Deposits",
  "auth.continueGoogle": "Continue with Google",
  "auth.connecting": "Connecting…",
  "auth.loginFailed": "Login failed. Try again or check your connection.",
  "auth.riskDisclaimer":
    "Crypto investments are subject to market risks. By continuing, you agree to our",
  "auth.termsOfService": "Terms of Service",
  "auth.and": "and",
  "auth.privacyPolicy": "Privacy Policy",
  "auth.loading": "Loading…",
  "auth.settingUp": "Setting up your account…",

  // Nav
  "nav.home": "Home",
  "nav.dca": "DCA",
  "nav.deposit": "Deposit",
  "nav.profile": "Profile",

  // Dashboard
  "dashboard.balanceIdrx": "IDRX Balance",
  "dashboard.balanceBtc": "cbBTC Balance (sats)",
  "dashboard.loadingWallet": "Loading wallet…",
  "dashboard.loading": "Loading…",
  "dashboard.walletNotDetected":
    "Privy wallet not detected. Open Profile or wait for sync.",
  "dashboard.copy": "Copy",
  "dashboard.copied": "Copied",
  "dashboard.depositIdr": "Deposit IDR → IDRX",
  "dashboard.depositDesc":
    "Convert rupiah to IDRX and start your first investment.",
  "dashboard.depositBtn": "Deposit",
  "dashboard.startInvesting": "Start Investing",
  "dashboard.startInvestingDesc":
    "Deposit IDR to your Arka wallet, then set up auto DCA into Bitcoin. Start small.",
  "dashboard.loadIdr": "Top-up IDR to IDRX",
  "dashboard.loadIdrDesc":
    "Convert rupiah to IDRX and start investing.",
  "dashboard.loadIdrBtn": "Top-up Now",
  "dashboard.savings": "Your Savings",
  "dashboard.viewAll": "View all",
  "dashboard.dcaActive": "DCA Active",
  "dashboard.dcaAutoTitle": "Auto DCA IDRX → cbBTC",
  "dashboard.dcaAutoDesc":
    "Schedule automatic Bitcoin purchases from your IDRX balance.",
  "dashboard.recentActivity": "Deposit Activity",
  "dashboard.failedLoadBalance": "Failed to load balance",
  "dashboard.failedLoadBtc":
    "Failed to read cbBTC balance — check RPC and contract address.",
  "dashboard.unlimitedSwaps": "unlimited",
  "dashboard.setBtcEnv":
    "Set NEXT_PUBLIC_BTC_ERC20_ADDRESS to cbBTC Base (one address, 42 chars).",

  // DCA
  "dca.title": "Auto DCA",
  "dca.checkingOrder": "Checking active order…",
  "dca.cannotRead": "Cannot read DCA status from contract.",
  "dca.subtitleActive":
    "Chainlink Automation executes IDRX → cbBTC swaps on schedule.",
  "dca.subtitleNew":
    "Schedule automatic cbBTC purchases from your IDRX balance. Once created, Chainlink Automation executes without any action needed.",
  "dca.active": "DCA Active",
  "dca.perSwap": "Per swap",
  "dca.frequency": "Frequency",
  "dca.executions": "Executions",
  "dca.next": "Next",
  "dca.minOutput": "Min. output",
  "dca.unlimited": "Unlimited",
  "dca.soon": "Soon",
  "dca.waitingKeeper": "Waiting for keeper…",
  "dca.cancelConfirm":
    "Are you sure you want to cancel DCA? Remaining IDRX stays in your wallet.",
  "dca.cancelling": "Cancelling…",
  "dca.cancelYes": "Yes, cancel",
  "dca.cancelBack": "Back",
  "dca.cancelBtn": "Cancel DCA",
  "dca.swapHistory": "Swap History",
  "dca.noSwapsYet":
    "No swaps executed yet. Chainlink Automation will run the first swap on schedule.",
  "dca.totalIdrx": "Total IDRX",
  "dca.totalBtc": "Total cbBTC",

  // DCA Form
  "dca.form.amountLabel": "Amount per swap (IDR)",
  "dca.form.amountPlaceholder": "e.g. 50000",
  "dca.form.amountHint": "IDRX amount swapped to cbBTC per execution.",
  "dca.form.frequencyLabel": "Frequency",
  "dca.form.swapsLabel": "Total executions",
  "dca.form.swapsPlaceholder": "0 = unlimited",
  "dca.form.swapsHint":
    "Leave empty or enter 0 for unlimited DCA (can be cancelled anytime).",
  "dca.form.info":
    "One confirmation: approve IDRX + create DCA order in a single transaction. Chainlink Automation then executes swaps automatically.",
  "dca.form.submit": "Start DCA",
  "dca.form.submitting": "Sending transaction…",
  "dca.form.success": "DCA order created successfully!",
  "dca.form.successHint":
    "Chainlink Automation will execute swaps automatically on schedule. No further action needed.",
  "dca.form.viewBasescan": "View on Basescan",
  "dca.form.errorAmount": "Enter amount per swap (min. Rp 1)",
  "dca.form.errorSwaps": "Swap count must be a whole number (0 = unlimited)",

  // DCA Smart Wallet
  "dca.smartWallet": "Smart wallet",
  "dca.smartBalance": "IDRX Balance",
  "dca.smartLoading": "Loading…",

  // DCA Interval labels
  "dca.interval.daily": "Daily",
  "dca.interval.weekly": "Weekly",
  "dca.interval.monthly": "Monthly",
  "dca.interval.minutes": "minutes",
  "dca.interval.hours": "hours",
  "dca.interval.days": "days",

  // Mint
  "mint.title": "Mint IDRX",
  "mint.subtitle":
    "Convert rupiah to IDRX into your Arka wallet. After the request is created, you'll be directed to the partner payment page.",
  "mint.checkingIdrx": "Checking IDRX status…",
  "mint.linkingIdrx": "Linking IDRX account (Privy email)…",
  "mint.linkingWait": "Just a moment…",
  "mint.preparing": "Preparing mint…",
  "mint.errorTitle": "Cannot prepare IDRX. Try again.",
  "mint.errorDefault":
    "Failed to check or link onboarding. Check your network and reload the page.",
  "mint.destLabel": "Destination wallet (Arka)",
  "mint.destWaiting": "Waiting for wallet…",
  "mint.amountLabel": "IDRX Amount (IDR)",
  "mint.amountPlaceholder": "Min. Rp 20,000",
  "mint.amountHint":
    "Minimum Rp 20,000 per IDRX policy. Payment amount may differ slightly after fees.",
  "mint.networkLabel": "Network",
  "mint.networkHint": "Base is selected as default for future product expansion.",
  "mint.expiryLabel": "Payment deadline",
  "mint.resultTitle":
    "Request created. Continue with payment to complete the mint.",
  "mint.resultTotalPay": "Total pay",
  "mint.resultReference": "Reference",
  "mint.resultOrder": "Order",
  "mint.resultPayBtn": "Continue to payment",
  "mint.resultActivityLink": "Activity",
  "mint.resultTrackPrefix": "Track status in",
  "mint.resultTrackSuffix": "after paying — verified via IDRX transaction API.",
  "mint.submit": "Create mint request",
  "mint.submitting": "Processing…",
  "mint.errorNoWallet": "Wallet not available",
  "mint.errorNoAmount": "Enter an amount",
  "mint.errorGeneric": "Request failed",
  "mint.processingNotice":
    "After payment is confirmed, it may take 1–2 minutes for IDRX to appear in your wallet.",

  // Activity
  "activity.title": "Activity",
  "activity.subtitle":
    "Deposit & mint IDRX history: payment and mint status from the partner API. IDRX/BTC wallet balances are read on-chain from Home.",
  "activity.reload": "Reload",
  "activity.failedLoad": "Failed to load",

  // Transaction list
  "tx.empty":
    "No mint transactions yet. After you create a request, the status will appear here.",
  "tx.amountIdrx": "IDRX Amount",
  "tx.payIdr": "Pay (IDR)",
  "tx.destWallet": "Destination wallet",
  "tx.reference": "Reference",
  "tx.merchantOrder": "Merchant order",
  "tx.createdAt": "Created",
  "tx.txHash": "Tx hash",

  // Transaction statuses
  "tx.status.waitingPayment": "Waiting for payment",
  "tx.status.expired": "Expired",
  "tx.status.failed": "Failed",
  "tx.status.paid": "Paid",
  "tx.status.minted": "Minted",
  "tx.status.processing": "Processing",
  "tx.status.approved": "Approved",
  "tx.status.mintFailed": "Mint failed",
  "tx.status.waiting": "Waiting",

  // Profile
  "profile.title": "Profile",
  "profile.subtitle":
    "Your Arka account and Privy wallet. Sensitive partner info (IDRX) is stored encrypted on the server.",
  "profile.name": "Name",
  "profile.email": "Email",
  "profile.wallet": "Arka Wallet",
  "profile.onboarding": "IDRX Onboarding",
  "profile.onboardingDone": "Completed",
  "profile.onboardingPending": "Not completed",
  "profile.logout": "Log Out",
  "profile.loadError": "Failed to load profile",
  "profile.retry": "Try again",

  // Savings
  "savings.title": "Savings",
  "savings.subtitle":
    "Manage your savings goals and BTC allocation. Real data will connect to your Privy wallet in a future release.",
  "savings.empty":
    "No savings yet. Start from Home by depositing IDRX, then set allocations per goal when this feature is ready.",

  // Onboarding
  "onboarding.title": "IDRX",
  "onboarding.subtitle":
    "Partner account is linked automatically when you open Mint — using your Privy email, no KYC upload needed here.",
  "onboarding.desc":
    "Open the Mint page to complete IDRX linking in the background and create IDRX requests.",
  "onboarding.goDeposit": "Go to Deposit",

  // Expiry presets
  "expiry.1h": "1 hour",
  "expiry.6h": "6 hours",
  "expiry.24h": "24 hours",

  // General
  "general.failedLoad": "Failed to load",
};

export type TranslationKey = keyof typeof id;
export { id, en };
