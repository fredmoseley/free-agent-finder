# Free Agent Finder ⚾️

Free Agent Finder is a powerful tool designed for fantasy baseball enthusiasts. It simplifies the process of identifying available players mentioned in sports articles by matching them directly against your league's free agent export.

## 🚀 Features

- **AI-Powered Extraction**: Uses Google Gemini AI to intelligently extract player names, team contexts, and potential bids from sports articles.
- **Multiple Source Support**:
  - **URLs**: Simply paste a link to an article.
  - **PDFs**: Upload PDF versions of scouting reports or articles.
  - **CSV Integration**: Seamlessly pulls data from CSV files containing player lists.
- **Smart Matching**: Employs fuzzy matching (via Fuse.js) with robust anti-false positive logic to reconcile player names in articles with your league's specific CSV export, accounting for nicknames and spelling variations.
- **Advanced Filtering**: Match players based on position, team, and availability.
- **Dynamic UI**: Collapsible position groups with "Expand All" and "Collapse All" functionality for quick data review.

## 🛠 Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS (v4)
- **Animations**: Motion (f.k.a. Framer Motion)
- **Backend/Tooling**: Express (for server-side integration), tsx
- **AI Integration**: Google Generative AI (@google/genai)
- **Data Parsing**: PapaParse (CSV), PDF.js (PDF extraction)
- **Search**: Fuse.js (Fuzzy string matching)
- **Icons**: Lucide React

## 📦 Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/free-agent-finder.git
   cd free-agent-finder
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the root directory and add your configuration:
   ```env
   GEMINI_API_KEY=your_api_key_here
   APP_URL=http://localhost:3000
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`.

## 📖 How to Use

1. **Upload your Free Agent CSV**: Export your league's free agent list (containing columns like Name, Team, Position) and upload it to the app.
2. **Provide the Article**: Paste a URL or upload a PDF of the scouting report or fantasy article you're reading.
3. **Run Match**: The AI will extract mentioned players, and the app will filter them against your CSV to show you who is actually available in your league.
4. **Review Results**: Use the "Matched Players" section to see suggested bids and context, grouped by position.

## ⚠️ Known Limitations

- **Free Agent Pool Only**: The application currently only matches players that are present in the uploaded Free Agent CSV. If an article mentions a player who is currently in the minor leagues (and thus not in your league's free agent pool export), they will not appear in the matched results.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request or open an issue for suggestions and bug reports.

## ⚖️ License

MIT License - see the [LICENSE](LICENSE) file for details.
