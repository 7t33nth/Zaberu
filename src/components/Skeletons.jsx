// Скелетоны для плавной загрузки карточек и меню вместо пустоты или спиннеров

export function RestaurantCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl bg-card border border-line animate-pulse">
      {/* Имитация обложки */}
      <div className="h-28 bg-line/60" />
      {/* Имитация информации о ресторане */}
      <div className="p-4 space-y-3">
        <div className="h-5 bg-line/80 rounded-md w-3/4" />
        <div className="h-3.5 bg-line/50 rounded-md w-1/2" />
        <div className="flex gap-2 pt-1">
          <div className="h-5 bg-line/60 rounded-full w-16" />
          <div className="h-5 bg-line/60 rounded-full w-20" />
        </div>
        <div className="h-6 bg-line/40 rounded-full w-28" />
      </div>
    </div>
  );
}

export function DishCardSkeleton() {
  return (
    <div className="flex gap-3 bg-card rounded-xl2 p-3 border border-line animate-pulse">
      <div className="w-[72px] h-[72px] rounded-xl bg-line/60 shrink-0" />
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 space-y-2">
        <div className="space-y-1.5">
          <div className="h-4 bg-line/80 rounded w-4/5" />
          <div className="h-3 bg-line/50 rounded w-3/5" />
        </div>
        <div className="flex items-center justify-between pt-1">
          <div className="h-4 bg-line/70 rounded w-14" />
          <div className="w-8 h-8 rounded-full bg-line/60 shrink-0" />
        </div>
      </div>
    </div>
  );
}

export function RestaurantMenuSkeleton() {
  return (
    <div className="pb-32 lg:pb-16 animate-pulse">
      {/* Имитация шапки ресторана */}
      <div className="h-52 bg-line/50 lg:rounded-3xl lg:mt-8 lg:max-w-[1200px] lg:mx-auto p-4 flex flex-col justify-between">
        <div className="w-10 h-10 rounded-full bg-line/80" />
        <div className="space-y-2 mb-2">
          <div className="h-7 bg-line/80 rounded w-1/3" />
          <div className="h-4 bg-line/60 rounded w-1/4" />
        </div>
      </div>

      <div className="lg:max-w-[1200px] lg:mx-auto lg:px-10 mt-6">
        {/* Категории */}
        <div className="flex gap-2 px-4 lg:px-0 py-3 overflow-hidden">
          <div className="h-9 w-24 bg-line/60 rounded-full shrink-0" />
          <div className="h-9 w-24 bg-line/60 rounded-full shrink-0" />
          <div className="h-9 w-24 bg-line/60 rounded-full shrink-0" />
          <div className="h-9 w-24 bg-line/60 rounded-full shrink-0" />
        </div>

        {/* Сетка блюд */}
        <div className="px-4 lg:px-0 grid grid-cols-1 lg:grid-cols-2 gap-3 mt-4">
          <DishCardSkeleton />
          <DishCardSkeleton />
          <DishCardSkeleton />
          <DishCardSkeleton />
        </div>
      </div>
    </div>
  );
}

export function OrderTrackingSkeleton() {
  return (
    <div className="flex flex-col px-5 pt-10 pb-10 min-h-dvh lg:max-w-[560px] lg:mx-auto lg:pt-16 animate-pulse">
      <div className="flex flex-col items-center">
        <div className="h-8 w-28 bg-line/60 rounded-full" />
        <div className="h-4 w-20 bg-line/40 rounded mt-8" />
        <div className="h-16 w-44 bg-line/80 rounded-2xl mt-2" />
        <div className="h-4 w-52 bg-line/40 rounded mt-2" />
        <div className="w-40 h-40 bg-line/50 rounded-xl2 mt-4" />
      </div>

      <div className="mt-8 bg-card rounded-xl2 border border-line p-5 flex flex-col items-center space-y-2">
        <div className="h-3 w-28 bg-line/40 rounded" />
        <div className="h-12 w-36 bg-line/80 rounded-xl" />
        <div className="h-8 w-48 bg-line/50 rounded-full mt-2" />
      </div>

      <div className="mt-4 bg-card rounded-xl2 border border-line p-4 space-y-2">
        <div className="h-4 bg-line/80 rounded w-1/3" />
        <div className="h-3.5 bg-line/50 rounded w-2/3" />
      </div>
    </div>
  );
}
