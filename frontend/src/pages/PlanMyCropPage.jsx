import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { getCropPlanningRecommendations } from '../services/api';

export default function PlanMyCropPage() {
  const { currentLang } = useLanguage();

  // Form State
  const [acres, setAcres] = useState(2);
  const [soilType, setSoilType] = useState('BLACK'); // 'BLACK' | 'RED'
  const [location, setLocation] = useState(null); // { latitude, longitude, label }
  const [locLoading, setLocLoading] = useState(true);
  const [locError, setLocError] = useState(null);

  // Submission State
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Translations dictionary for Plan My Crop
  const texts = {
    en: {
      pageTitle: 'Plan My Crop',
      pageSubtitle: 'Find the most profitable and suitable crops tailored to your land, soil, and season.',
      howMuchLand: 'How much land do you have?',
      acresLabel: 'Acres',
      soilTypeHeading: 'Select Soil Type',
      blackSoilTitle: 'Black Soil',
      blackSoilSubtitle: 'High moisture retention, clayey, ideal for cotton & pulses',
      redSoilTitle: 'Red Soil',
      redSoilSubtitle: 'Well-drained, loamy/chalka, ideal for groundnut & vegetables',
      locationHeading: 'Your Location',
      locatingText: 'Detecting your farm location...',
      locationDetected: 'Location automatically detected',
      locationDenied: 'Location access was not granted. Using regional agro-climatic defaults.',
      retryLocation: 'Retry GPS Detection',
      btnGetSuggestions: '🌱 Get Crop Suggestions',
      btnLoading: 'Analyzing Soil & Season with AI...',
      resultsHeading: 'Recommended Crops for Your Land',
      contextLocation: 'Location',
      contextSeason: 'Season',
      contextSoil: 'Soil',
      contextLand: 'Land Area',
      whySuitable: 'Why this suits your land:',
      investmentHeading: 'Estimated Investment',
      returnHeading: 'Estimated Return',
      perAcre: 'Per Acre',
      forYourLand: 'For your',
      estimatedTag: 'Estimated',
      durationLabel: 'Duration to Harvest:',
      keyRiskLabel: 'Key Care / Risk:',
      govSupportTitle: 'Government Support & Schemes',
      whatSupports: 'What it supports:',
      howToApply: 'Where/how to apply:',
      sourceLabel: 'Verified Source:',
      govNotice: 'Government support information is provided for guidance. Final eligibility and subsidies are subject to official verification by the Agriculture Department.',
      planAnother: '← Plan Another Plot',
    },
    te: {
      pageTitle: 'పంట ప్రణాళిక (Plan My Crop)',
      pageSubtitle: 'మీ నేల రకం, భూమి విస్తీర్ణం మరియు ప్రస్తుత కాలానికి సరిపోయే లాభదాయకమైన పంటల సలహాలు.',
      howMuchLand: 'మీకు ఎంత భూమి ఉంది?',
      acresLabel: 'ఎకరాలు',
      soilTypeHeading: 'నేల రకాన్ని ఎంచుకోండి',
      blackSoilTitle: 'నల్లరేగడి నేల (Black Soil)',
      blackSoilSubtitle: 'తేమ నిల్వ సామర్థ్యం ఎక్కువ, పత్తి మరియు పప్పుధాన్యాలకు అనుకూలం',
      redSoilTitle: 'ఎర్ర నేల (Red Soil)',
      redSoilSubtitle: 'తేలికపాటి గరప నేల, వేరుశనగ మరియు కూరగాయలకు శ్రేష్టం',
      locationHeading: 'మీ స్థానం (Location)',
      locatingText: 'మీ పొలం స్థానాన్ని గుర్తిస్తున్నాము...',
      locationDetected: 'స్థానం స్వయంచాలకంగా గుర్తించబడింది',
      locationDenied: 'లొకేషన్ అనుమతి లభించలేదు. ప్రాంతీయ సాధారణ సమాచారం ఉపయోగించబడుతుంది.',
      retryLocation: 'మళ్లీ గుర్తించు',
      btnGetSuggestions: '🌱 పంటల సిఫార్సులు పొందండి',
      btnLoading: 'నేల మరియు కాలాన్ని విశ్లేషిస్తున్నాము...',
      resultsHeading: 'మీ భూమికి సిఫార్సు చేయబడిన పంటలు',
      contextLocation: 'ప్రాంతం',
      contextSeason: 'కాలం',
      contextSoil: 'నేల రకం',
      contextLand: 'భూమి విస్తీర్ణం',
      whySuitable: 'ఈ పంట ఎందుకు అనుకూలం:',
      investmentHeading: 'అంచనా పెట్టుబడి',
      returnHeading: 'అంచనా రాబడి',
      perAcre: 'ఎకరానికి',
      forYourLand: 'మీ',
      estimatedTag: 'అంచనా',
      durationLabel: 'పంట కాల పరిమితి:',
      keyRiskLabel: 'జాగ్రత్తలు / చీడపీడల నియంత్రణ:',
      govSupportTitle: 'ప్రభుత్వ సహాయం & పథకాలు',
      whatSupports: 'పథకం ప్రయోజనం:',
      howToApply: 'ఎలా దరఖాస్తు చేసుకోవాలి:',
      sourceLabel: 'ధృవీకరించిన మూలం:',
      govNotice: 'ప్రభుత్వ పథకాల సమాచారం అవగాహన కొరకు మాత్రమే. తుది అర్హత మరియు రాయితీలను వ్యవసాయ శాఖ అధికారులు ధృవీకరిస్తారు.',
      planAnother: '← మరొక పొలానికి ప్రణాళిక చేయండి',
    },
    hi: {
      pageTitle: 'फसल योजना (Plan My Crop)',
      pageSubtitle: 'अपनी जमीन, मिट्टी और मौसम के अनुसार सबसे उपयुक्त और लाभदायक फसलों की जानकारी पाएं।',
      howMuchLand: 'आपके पास कितनी जमीन है?',
      acresLabel: 'एकड़',
      soilTypeHeading: 'मिट्टी का प्रकार चुनें',
      blackSoilTitle: 'काली मिट्टी (Black Soil)',
      blackSoilSubtitle: 'नमी सोखने वाली गहरी मिट्टी, कपास और दलहन के लिए उत्तम',
      redSoilTitle: 'लाल मिट्टी (Red Soil)',
      redSoilSubtitle: 'भुरभुरी, जल निकासी वाली मिट्टी, मूंगफली और सब्जियों के लिए सही',
      locationHeading: 'आपका स्थान (Location)',
      locatingText: 'आपके खेत का स्थान खोजा जा रहा है...',
      locationDetected: 'स्थान स्वतः पहचाना गया',
      locationDenied: 'स्थान अनुमति नहीं मिली। क्षेत्रीय मानक उपयोग किए जा रहे हैं।',
      retryLocation: 'पुनः प्रयास करें',
      btnGetSuggestions: '🌱 उपयुक्त फसल सुझाव देखें',
      btnLoading: 'मिट्टी और मौसम का विश्लेषण जारी है...',
      resultsHeading: 'आपकी भूमि के लिए अनुशंसित फसलें',
      contextLocation: 'स्थान',
      contextSeason: 'मौसम',
      contextSoil: 'मिट्टी',
      contextLand: 'जमीन का रकबा',
      whySuitable: 'यह फसल क्यों उपयुक्त है:',
      investmentHeading: 'अनुमानित लागत / निवेश',
      returnHeading: 'अनुमानित आय / मुनाफा',
      perAcre: 'प्रति एकड़',
      forYourLand: 'आपके',
      estimatedTag: 'अनुमानित',
      durationLabel: 'फसल अवधि:',
      keyRiskLabel: 'मुख्य सावधानी / कीट नियंत्रण:',
      govSupportTitle: 'सरकारी योजनाएं और सहायता',
      whatSupports: 'योजना से लाभ:',
      howToApply: 'आवेदन प्रक्रिया:',
      sourceLabel: 'सत्यापित स्रोत:',
      govNotice: 'सरकारी सहायता की जानकारी मार्गदर्शन हेतु है। अंतिम पात्रता कृषि विभाग द्वारा सत्यापित की जाती है।',
      planAnother: '← दूसरे खेत के लिए योजना बनाएं',
    },
  };

  const t = texts[currentLang] || texts.en;

  // 1. Fetch Geolocation automatically on mount
  const detectLocation = () => {
    setLocLoading(true);
    setLocError(null);

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setLocation({
            latitude: lat,
            longitude: lng,
            label: `${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E`,
          });
          setLocLoading(false);
        },
        (err) => {
          console.warn('[CropPlanning] Geolocation error:', err.message);
          setLocError(t.locationDenied);
          // Graceful fallback coordinate (Telangana/Andhra central coordinates)
          setLocation({
            latitude: 17.448,
            longitude: 78.672,
            label: 'Hyderabad Region, Telangana (Default)',
          });
          setLocLoading(false);
        },
        { enableHighAccuracy: false, timeout: 8000 }
      );
    } else {
      setLocError(t.locationDenied);
      setLocation({
        latitude: 17.448,
        longitude: 78.672,
        label: 'Hyderabad Region, Telangana (Default)',
      });
      setLocLoading(false);
    }
  };

  useEffect(() => {
    detectLocation();
  }, []);

  // Handle + / - Acre Stepper
  const handleAcreChange = (delta) => {
    setAcres((prev) => {
      const next = prev + delta;
      if (next < 1) return 1;
      if (next > 50) return 50;
      return next;
    });
  };

  // Submit to API
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      const res = await getCropPlanningRecommendations({
        landAreaAcres: acres,
        soilType,
        latitude: location?.latitude,
        longitude: location?.longitude,
        language: currentLang || 'en',
      });

      if (res && res.success) {
        setResult(res);
      } else {
        setError('Could not generate crop recommendations. Please try again.');
      }
    } catch (err) {
      console.error('Failed to get crop recommendations:', err);
      setError(err.message || 'Error communicating with agricultural planning engine.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '24px 16px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* HEADER */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: '#ecfdf5', color: '#065f46', padding: '6px 16px', borderRadius: '20px', fontWeight: '700', fontSize: '0.875rem', marginBottom: '10px' }}>
          <span>🌾</span> Agricultural Decision Assistant
        </div>
        <h1 style={{ margin: '0 0 8px', fontSize: '2rem', fontWeight: '800', color: '#0f172a' }}>
          {t.pageTitle}
        </h1>
        <p style={{ margin: 0, fontSize: '1rem', color: '#475569', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
          {t.pageSubtitle}
        </p>
      </div>

      {error && (
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '14px 18px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.9375rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>⚠️</span> {error}
        </div>
      )}

      {/* INPUT FORM (Visible when no result is displayed) */}
      {!result ? (
        <form onSubmit={handleSubmit} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '28px 24px', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
          {/* 1. LAND AREA SELECTOR */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <label style={{ display: 'block', fontSize: '1.0625rem', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>
              {t.howMuchLand}
            </label>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '20px', backgroundColor: '#f8fafc', padding: '12px 24px', borderRadius: '16px', border: '2px solid #e2e8f0' }}>
              <button
                type="button"
                data-testid="decrease-acres-btn"
                onClick={() => handleAcreChange(-1)}
                disabled={acres <= 1}
                aria-label="Decrease acres"
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  border: '2px solid #cbd5e1',
                  backgroundColor: acres <= 1 ? '#f1f5f9' : '#ffffff',
                  color: acres <= 1 ? '#94a3b8' : '#0f172a',
                  fontSize: '1.75rem',
                  fontWeight: '700',
                  cursor: acres <= 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                −
              </button>

              <div style={{ minWidth: '100px', textAlign: 'center' }}>
                <span data-testid="acres-count" style={{ display: 'block', fontSize: '3rem', fontWeight: '900', color: '#15803d', lineHeight: 1 }}>
                  {acres}
                </span>
                <span style={{ fontSize: '0.9375rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {acres === 1 ? 'Acre' : t.acresLabel}
                </span>
              </div>

              <button
                type="button"
                data-testid="increase-acres-btn"
                onClick={() => handleAcreChange(1)}
                disabled={acres >= 50}
                aria-label="Increase acres"
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  border: '2px solid #cbd5e1',
                  backgroundColor: acres >= 50 ? '#f1f5f9' : '#ffffff',
                  color: acres >= 50 ? '#94a3b8' : '#0f172a',
                  fontSize: '1.75rem',
                  fontWeight: '700',
                  cursor: acres >= 50 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                +
              </button>
            </div>
          </div>

          {/* 2. SOIL TYPE SELECTION CARDS */}
          <div style={{ marginBottom: '32px' }}>
            <label style={{ display: 'block', fontSize: '1.0625rem', fontWeight: '700', color: '#1e293b', marginBottom: '14px', textAlign: 'center' }}>
              {t.soilTypeHeading}
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
              {/* BLACK SOIL CARD */}
              <div
                role="button"
                data-testid="soil-black-btn"
                tabIndex={0}
                onClick={() => setSoilType('BLACK')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSoilType('BLACK'); }}
                style={{
                  border: soilType === 'BLACK' ? '3px solid #047857' : '2px solid #e2e8f0',
                  backgroundColor: soilType === 'BLACK' ? '#f0fdf4' : '#ffffff',
                  borderRadius: '16px',
                  padding: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  boxShadow: soilType === 'BLACK' ? '0 8px 16px -4px rgba(4, 120, 87, 0.15)' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '1.5rem' }}>🟤</span>
                  {soilType === 'BLACK' && (
                    <span style={{ backgroundColor: '#047857', color: '#ffffff', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', fontWeight: '800' }}>
                      ✓
                    </span>
                  )}
                </div>
                <div style={{ fontWeight: '800', fontSize: '1.1875rem', color: '#1e293b', marginBottom: '4px' }}>
                  {t.blackSoilTitle}
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.4 }}>
                  {t.blackSoilSubtitle}
                </div>
              </div>

              {/* RED SOIL CARD */}
              <div
                role="button"
                data-testid="soil-red-btn"
                tabIndex={0}
                onClick={() => setSoilType('RED')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSoilType('RED'); }}
                style={{
                  border: soilType === 'RED' ? '3px solid #b91c1c' : '2px solid #e2e8f0',
                  backgroundColor: soilType === 'RED' ? '#fef2f2' : '#ffffff',
                  borderRadius: '16px',
                  padding: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  boxShadow: soilType === 'RED' ? '0 8px 16px -4px rgba(185, 28, 28, 0.15)' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '1.5rem' }}>🔴</span>
                  {soilType === 'RED' && (
                    <span style={{ backgroundColor: '#b91c1c', color: '#ffffff', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', fontWeight: '800' }}>
                      ✓
                    </span>
                  )}
                </div>
                <div style={{ fontWeight: '800', fontSize: '1.1875rem', color: '#1e293b', marginBottom: '4px' }}>
                  {t.redSoilTitle}
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.4 }}>
                  {t.redSoilSubtitle}
                </div>
              </div>
            </div>
          </div>

          {/* 3. LOCATION INFORMATION */}
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 18px', marginBottom: '28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '1.5rem' }}>📍</span>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>
                  {t.locationHeading}
                </div>
                <div style={{ fontSize: '0.9375rem', fontWeight: '700', color: '#0f172a' }}>
                  {locLoading ? t.locatingText : (location?.label || t.locationDetected)}
                </div>
                {locError && (
                  <div style={{ fontSize: '0.75rem', color: '#ea580c', marginTop: '2px' }}>
                    {locError}
                  </div>
                )}
              </div>
            </div>

            {locError && (
              <button
                type="button"
                onClick={detectLocation}
                style={{ fontSize: '0.75rem', padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', cursor: 'pointer', fontWeight: '600' }}
              >
                🔄 {t.retryLocation}
              </button>
            )}
          </div>

          {/* 4. SUBMIT BUTTON */}
          <button
            type="submit"
            data-testid="submit-crop-planning"
            disabled={loading || locLoading}
            style={{
              width: '100%',
              padding: '16px 24px',
              backgroundColor: '#15803d',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '1.125rem',
              fontWeight: '800',
              cursor: (loading || locLoading) ? 'not-allowed' : 'pointer',
              opacity: (loading || locLoading) ? 0.7 : 1,
              boxShadow: '0 4px 14px rgba(21, 128, 61, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transition: 'background-color 0.15s ease',
            }}
          >
            {loading ? (
              <>
                <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                {t.btnLoading}
              </>
            ) : (
              t.btnGetSuggestions
            )}
          </button>
        </form>
      ) : (
        /* RESULTS VIEW */
        <div>
          {/* CONTEXT SUMMARY CARD */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px 24px', marginBottom: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '16px' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', display: 'block' }}>
                  📍 {t.contextLocation}
                </span>
                <strong style={{ fontSize: '0.9375rem', color: '#0f172a' }}>
                  {result.summary?.location_label || result.input?.location}
                </strong>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', display: 'block' }}>
                  🌱 {t.contextSeason}
                </span>
                <strong style={{ fontSize: '0.9375rem', color: '#047857' }}>
                  {result.summary?.season_label}
                </strong>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', display: 'block' }}>
                  🌾 {t.contextSoil}
                </span>
                <strong style={{ fontSize: '0.9375rem', color: '#0f172a' }}>
                  {result.summary?.soil_label}
                </strong>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', display: 'block' }}>
                  📐 {t.contextLand}
                </span>
                <strong style={{ fontSize: '0.9375rem', color: '#15803d' }}>
                  {result.summary?.land_label}
                </strong>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.9375rem', color: '#334155', fontWeight: '600' }}>
              {result.summary?.intro_text}
            </p>
          </div>

          {/* RECOMMENDED CROPS */}
          <h2 style={{ fontSize: '1.375rem', fontWeight: '800', color: '#0f172a', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🌱</span> {t.resultsHeading}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginBottom: '32px' }}>
            {result.recommendations?.map((rec, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.03)',
                  borderLeft: '5px solid #15803d',
                }}
              >
                {/* Crop Name & Index */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ width: '32px', height: '32px', backgroundColor: '#dcfce7', color: '#15803d', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '1rem' }}>
                      {index + 1}
                    </span>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>
                      {rec.crop_name}
                    </h3>
                  </div>

                  <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '4px 10px', borderRadius: '20px', backgroundColor: '#f1f5f9', color: '#475569' }}>
                    ⏳ {t.durationLabel} <strong>{rec.estimated_duration}</strong>
                  </span>
                </div>

                {/* Reason why it suits */}
                <div style={{ marginBottom: '16px', fontSize: '0.875rem', color: '#334155', lineHeight: 1.5 }}>
                  <strong style={{ color: '#0f172a' }}>{t.whySuitable} </strong>
                  {rec.reason}
                </div>

                {/* INVESTMENT & RETURN BREAKDOWN (PER ACRE & FOR TOTAL LAND) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                  {/* Investment Box */}
                  <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '12px', padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: '#9a3412' }}>
                        💰 {t.investmentHeading}
                      </span>
                      <span style={{ fontSize: '0.6875rem', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#ffedd5', color: '#c2410c' }}>
                        {t.estimatedTag}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8125rem', color: '#431407', marginBottom: '6px' }}>
                      {t.perAcre}: <strong>₹{rec.estimated_investment_per_acre?.toLocaleString('en-IN')}</strong>
                    </div>

                    <div style={{ fontSize: '1.0625rem', fontWeight: '900', color: '#c2410c', borderTop: '1px dashed #fed7aa', paddingTop: '6px' }}>
                      {t.forYourLand} {acres} {t.acresLabel}: ₹{rec.estimated_total_investment?.toLocaleString('en-IN')}
                    </div>
                  </div>

                  {/* Return Box */}
                  <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: '#166534' }}>
                        📈 {t.returnHeading}
                      </span>
                      <span style={{ fontSize: '0.6875rem', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#dcfce7', color: '#15803d' }}>
                        {t.estimatedTag}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8125rem', color: '#14532d', marginBottom: '6px' }}>
                      {t.perAcre}: <strong>₹{rec.estimated_return_per_acre_min?.toLocaleString('en-IN')} – ₹{rec.estimated_return_per_acre_max?.toLocaleString('en-IN')}</strong>
                    </div>

                    <div style={{ fontSize: '1.0625rem', fontWeight: '900', color: '#15803d', borderTop: '1px dashed #bbf7d0', paddingTop: '6px' }}>
                      {t.forYourLand} {acres} {t.acresLabel}: ₹{rec.estimated_total_return_min?.toLocaleString('en-IN')} – ₹{rec.estimated_total_return_max?.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                {/* Key Risk / Precaution */}
                <div style={{ backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px', borderLeft: '3px solid #f59e0b', fontSize: '0.8125rem', color: '#475569' }}>
                  <strong style={{ color: '#b45309' }}>⚠️ {t.keyRiskLabel} </strong>
                  {rec.risk_note}
                </div>
              </div>
            ))}
          </div>

          {/* GOVERNMENT SCHEMES & SUPPORT SECTION */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', marginBottom: '28px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.1875rem', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🏛️</span> {t.govSupportTitle}
            </h3>

            {result.has_government_support && result.government_support?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
                {result.government_support.map((sch, i) => (
                  <div key={i} style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontWeight: '800', fontSize: '1rem', color: '#1e40af', marginBottom: '6px' }}>
                      📋 {sch.name}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#334155', marginBottom: '4px' }}>
                      <strong>{t.whatSupports}</strong> {sch.what_it_supports}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#0369a1', marginBottom: '6px', fontWeight: '600' }}>
                      💡 {sch.relevance}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#475569', marginBottom: '6px' }}>
                      <strong>{t.howToApply}</strong> {sch.how_to_apply}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                      <strong>{t.sourceLabel}</strong> {sch.source}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '0.875rem', marginTop: '10px' }}>
                ℹ️ {result.government_support_unavailable_message || 'Government support information is currently unavailable for this recommendation.'}
              </div>
            )}

            <div style={{ marginTop: '16px', fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
              {t.govNotice}
            </div>
          </div>

          {/* DISCLAIMER BOX */}
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '28px', fontSize: '0.8125rem', color: '#64748b', lineHeight: 1.5 }}>
            <strong>📌 Disclaimer:</strong> {result.disclaimer}
          </div>

          {/* RESET BUTTON */}
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <button
              type="button"
              data-testid="plan-another-btn"
              onClick={handleReset}
              style={{
                padding: '12px 28px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                fontWeight: '700',
                fontSize: '0.9375rem',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
              }}
            >
              {t.planAnother}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
