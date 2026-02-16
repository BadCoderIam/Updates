"use client";

import { useMemo, useState } from "react";

type MerchItem = {
  id: string;
  name: string;
  price?: string;
  img: string;
};

export default function MerchModal(props: { open: boolean; onClose: () => void }) {
  const items = useMemo<MerchItem[]>(
    () => [
      { id: "pens", name: "LevelUp Pro Pens", img: "/merch/01-pens.png" },
      { id: "mousepad", name: "Mousepad", img: "/merch/02-mousepad.png" },
      { id: "usb-keys", name: "USB Keychain Set", img: "/merch/03-usb-keys.png" },
      { id: "mug", name: "Coffee Mug", img: "/merch/04-mug.png" },
      { id: "usb-single", name: "USB Key", img: "/merch/05-usb-single.png" },
      { id: "hoodie", name: "Hoodie", img: "/merch/06-hoodie.png" },
    ],
    []
  );

  const [selected, setSelected] = useState<string>("");

  if (!props.open) return null;

  return (
    <div className="luModalOverlay" onClick={props.onClose}>
      <div className="luModal luMerchModal" role="dialog" aria-modal="true" aria-label="Merch" onClick={(e) => e.stopPropagation()}>
        <div className="luModalHeader">
          <div>
            <b style={{ fontSize: 18 }}>Merch</b>
            <div><small className="luHint">Select an item to save it for later. Checkout will be wired when you’re ready.</small></div>
          </div>
          <button className="secondaryBtn" type="button" onClick={props.onClose}>Close</button>
        </div>

        <div className="luMerchScroller" role="list" aria-label="Merch items">
          {items.map((it) => (
            <button
              key={it.id}
              className={"luMerchCard" + (selected === it.id ? " selected" : "")}
              type="button"
              onClick={() => setSelected(it.id)}
              role="listitem"
            >
              <div className="luMerchImgWrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.img} alt={it.name} className="luMerchImg" />
              </div>
              <div className="luMerchMeta">
                <b>{it.name}</b>
                <small>{it.price ?? "Coming soon"}</small>
              </div>
            </button>
          ))}
        </div>

        <div className="luModalFooter">
          <div className="luHint">
            {selected ? <>Selected: <b>{items.find((i) => i.id === selected)?.name}</b></> : "Pick an item to select it."}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="secondaryBtn" type="button" onClick={() => setSelected("")} disabled={!selected}>Clear</button>
            <button className="primaryBtn" type="button" disabled={!selected}>Save selection</button>
          </div>
        </div>
      </div>
    </div>
  );
}
