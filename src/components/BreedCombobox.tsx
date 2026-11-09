import { useMemo, useState } from "react";
import type { Breed } from "../data/breeds.ts";
import { searchBreeds } from "../lib/breedSearch.ts";

type BreedComboboxProps = {
  breedId?: string;
  breedName: string;
  onChange: (selection: {
    breedId?: string;
    breedName: string;
    breed?: Breed;
  }) => void;
  disabled?: boolean;
};

export default function BreedCombobox({
  breedId,
  breedName,
  onChange,
  disabled = false,
}: BreedComboboxProps) {
  const [query, setQuery] = useState(breedName);
  const [isOpen, setIsOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  const results = useMemo(() => searchBreeds(query, 12), [query]);
  const selected = results.find((breed) => breed.id === breedId);

  function selectBreed(breed: Breed) {
    setQuery(breed.name);
    setHighlighted(0);
    setIsOpen(false);
    onChange({ breedId: breed.id, breedName: breed.name, breed });
  }

  function handleInput(value: string) {
    setQuery(value);
    setIsOpen(true);
    setHighlighted(0);
    // Typing clears a previously selected catalogue id so free-text breed
    // names are stored honestly rather than attributed to the wrong breed.
    if (breedId || value !== breedName) {
      onChange({ breedName: value });
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setIsOpen(true);
      return;
    }
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((index) => Math.min(index + 1, results.length - 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((index) => Math.max(index - 1, 0));
    }
    if (event.key === "Enter" && isOpen && results[highlighted]) {
      event.preventDefault();
      selectBreed(results[highlighted]);
    }
  }

  return (
    <div className="relative">
      <label
        htmlFor="dog-breed-search"
        className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2"
      >
        Breed
      </label>
      <input
        id="dog-breed-search"
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls="dog-breed-options"
        aria-autocomplete="list"
        autoComplete="off"
        value={query}
        disabled={disabled}
        placeholder="Search 100+ breeds or type your own"
        onFocus={() => setIsOpen(true)}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        onChange={(event) => handleInput(event.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full px-4 py-3 rounded-xl border-2 border-warm-brown/20 bg-cream text-text-dark text-sm outline-none focus:border-warm-brown/50 transition-colors disabled:opacity-50"
      />

      {selected && (
        <p className="mt-1 text-xs text-text-muted">
          {selected.size} · {selected.maleWeightKg[0]}–{selected.maleWeightKg[1]}{" "}
          kg male · {selected.femaleWeightKg[0]}–{selected.femaleWeightKg[1]} kg
          female
        </p>
      )}

      {isOpen && (
        <ul
          id="dog-breed-options"
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-warm-brown/15 bg-white p-1 shadow-xl"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-text-muted">
              No catalogue match. Keep typing to save “{query}” as a free-text
              breed.
            </li>
          ) : (
            results.map((breed, index) => (
              <li key={breed.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === highlighted}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectBreed(breed)}
                  onMouseEnter={() => setHighlighted(index)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                    index === highlighted
                      ? "bg-light-tan text-warm-brown"
                      : "text-text-dark hover:bg-cream"
                  }`}
                >
                  <span className="font-medium">{breed.name}</span>
                  <span className="text-xs text-text-muted">{breed.size}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
