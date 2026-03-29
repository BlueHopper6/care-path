import { NextRequest, NextResponse } from "next/server";

interface AnalyzeRequest {
  raw_text: string;
  mode: "simple" | "detailed";
  language: string;
}

interface AnalyzeResponse {
  summary: string;
  action_plan: string[];
  questions_for_doctor: string[];
  warning_signs: string[];
}

// Mock response generator for development/demo purposes
// Replace this with actual API call when backend is ready
function generateMockResponse(data: AnalyzeRequest): AnalyzeResponse {
  const isSimple = data.mode === "simple";

  return {
    summary: isSimple
      ? "Your doctor wants you to take some medicine and rest. You had some tests done and most things look okay. There are a few things to watch out for, and you need to come back for a check-up soon."
      : "Based on the provided medical documentation, the patient has been diagnosed with a respiratory tract infection. Laboratory results indicate elevated white blood cell count consistent with bacterial infection. Treatment plan includes a 7-day course of antibiotics and supportive care measures.",

    action_plan: isSimple
      ? [
          "Take your medicine every morning with breakfast",
          "Drink lots of water - at least 8 glasses a day",
          "Rest at home for the next few days",
          "Call your doctor if you feel worse",
          "Come back for a check-up in one week",
        ]
      : [
          "Take Amoxicillin 500mg three times daily with food for 7 days",
          "Maintain adequate hydration with a minimum of 2 liters of fluids daily",
          "Monitor temperature twice daily and record readings",
          "Complete full course of antibiotics even if symptoms improve",
          "Schedule follow-up appointment for reassessment in 7-10 days",
          "Rest and avoid strenuous physical activity during recovery period",
        ],

    questions_for_doctor: isSimple
      ? [
          "What should I do if I forget to take my medicine?",
          "Can I go back to school/work while taking this medicine?",
          "Are there any foods I should avoid?",
          "How will I know if the medicine is working?",
        ]
      : [
          "What are the potential drug interactions with my current medications?",
          "Should I take probiotics during the antibiotic course?",
          "What symptoms would indicate treatment failure requiring reassessment?",
          "Are there any activity restrictions during the recovery period?",
          "When should I expect symptom improvement?",
        ],

    warning_signs: isSimple
      ? [
          "Very high fever that won't go down",
          "Trouble breathing or chest pain",
          "Throwing up and can't keep medicine down",
          "Rash or itchy skin after taking medicine",
        ]
      : [
          "Temperature exceeding 39.5°C (103°F) despite antipyretic medication",
          "Acute respiratory distress or severe shortness of breath",
          "Persistent vomiting preventing oral medication intake",
          "Signs of allergic reaction: rash, swelling, or difficulty breathing",
          "Symptoms worsening after 48-72 hours of antibiotic therapy",
        ],
  };
}

export async function POST(request: NextRequest) {
  try {
    const data: AnalyzeRequest = await request.json();

    // Validate request
    if (!data.raw_text || !data.raw_text.trim()) {
      return NextResponse.json(
        { error: "Medical text is required" },
        { status: 400 }
      );
    }

    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Generate mock response
    // In production, this would call your actual analysis service
    const response = generateMockResponse(data);

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: "Failed to analyze medical text" },
      { status: 500 }
    );
  }
}
