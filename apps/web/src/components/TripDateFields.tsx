"use client";

import { useRef, useState } from "react";
import { addIsoDays, checkoutAfterCheckIn } from "@/lib/trip-form";

export function TripDateFields({
  initialCheckIn,
  initialCheckOut,
  today,
}: {
  initialCheckIn: string;
  initialCheckOut: string;
  today: string;
}) {
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const followsCheckIn = useRef(false);

  return (
    <>
      <label>
        <span>Check-in</span>
        <input
          className="field"
          type="date"
          name="checkIn"
          min={today}
          value={checkIn}
          onChange={(event) => {
            const nextCheckIn = event.target.value;
            setCheckIn(nextCheckIn);
            setCheckOut((current) => {
              if (!nextCheckIn) return current;
              if (followsCheckIn.current) return addIsoDays(nextCheckIn, 7);
              const nextCheckOut = checkoutAfterCheckIn(nextCheckIn, current);
              followsCheckIn.current = nextCheckOut !== current;
              return nextCheckOut;
            });
          }}
          onBlur={() => {
            followsCheckIn.current = false;
          }}
          required
        />
      </label>
      <label>
        <span>Check-out</span>
        <input
          className="field"
          type="date"
          name="checkOut"
          min={addIsoDays(checkIn || today, 1)}
          value={checkOut}
          onChange={(event) => {
            followsCheckIn.current = false;
            setCheckOut(event.target.value);
          }}
          required
        />
      </label>
    </>
  );
}
