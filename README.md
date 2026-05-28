# BLDC Motor Simulator

Interactive browser-based simulator for explaining how Brushless DC (BLDC) motors behave under different commutation and drive strategies.

## Purpose

This application is an educational aid for exploring BLDC operation concepts visually and interactively.  
It helps users understand the relationship between electrical drive signals, rotor position, torque production, and speed response without requiring hardware.

## Application Functionality

### 1. Real-Time Motor Visualization
- Displays a stylized motor cross-section with stator coils and rotor poles.
- Animates rotor motion continuously to connect control inputs to visible movement.
- Shows a rotating stator field vector to illustrate commanded electrical angle and field direction.
- Highlights phase coil energization in real time to make magnetic field generation intuitive.

**Purpose:** Build conceptual understanding of how electromagnetic excitation maps to rotor behavior.

### 2. Commutation Strategy Modes
- **Manual:** User sets electrical angle directly.
- **Open Loop:** Electrical angle advances at a throttle-driven rate without rotor feedback.
- **Closed Loop:** Electrical angle tracks rotor angle with configurable lead/advance.
- **Sensorless:** Demonstrates back-EMF zero-crossing style step progression.

**Purpose:** Compare control philosophies and explain where each strategy is useful, strong, or limited.

### 3. Signal Generation Modes
- **FOC / Sine (Sinusoidal):** Smooth three-phase sinusoidal drive.
- **6-Step / Trap (Trapezoidal):** Sector-based commutation table output.

**Purpose:** Show waveform strategy differences and how they influence phase voltages, smoothness, and torque characteristics.

### 4. Interactive Control Inputs
- **Throttle:** Sets excitation magnitude and strongly influences torque/speed behavior.
- **Manual Angle:** Sets commanded electrical angle in Manual mode.
- **Advance Angle (Field Weakening):** Shifts electrical lead to demonstrate speed/torque tradeoffs.
- **Pole Pair Selection:** Switches motor pole-pair count and updates electrical/mechanical angle relationship.
- **Run/Pause:** Freezes and resumes simulation dynamics for step-by-step explanation.

**Purpose:** Provide hands-on experimentation to reinforce how each parameter changes motor response.

### 5. Telemetry and Diagnostic Feedback
- Live readouts for:
  - Speed (RPM)
  - Torque (per-unit)
  - Electrical angle
  - Rotor mechanical angle
- Real-time U/V/W phase voltage bars (including polarity visualization).

**Purpose:** Tie qualitative visuals to quantitative indicators so users can interpret control behavior with measurable signals.

### 6. Simplified Dynamics Model for Teaching
- Includes simplified torque generation from electrical-mechanical angle alignment.
- Includes drag and velocity integration to produce believable acceleration and steady-state behavior.
- Includes conceptual field-weakening effect through advance-angle-dependent drag reduction.

**Purpose:** Deliver understandable cause-and-effect behavior suitable for explanation and learning, while remaining lightweight and interactive.

## Running the Simulator

1. Install dependencies:
   ```bash
   npm install
   ```
2. Serve the repository root with any static file server (for example):
   ```bash
   npx serve .
   ```
3. Open the served URL in a browser.

## Testing

Run Playwright tests:

```bash
npm test
```