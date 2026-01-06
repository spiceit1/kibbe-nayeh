import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'

export default function AboutPage() {
  return (
    <div className="space-y-10">
      <div className="max-w-3xl space-y-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-pomegranate">History of Kibbeh Nayeh</p>
        <h1 className="font-display text-4xl text-midnight">Levantine tradition, served with care</h1>
        <p className="text-lg text-midnight/80">
          Kibbeh Nayeh is a raw dish of finely ground meat, bulgur, and spices that traces its roots to the Levant,
          especially the mountains of Lebanon and Syria. Historically, families prepared it on feast days and harvest
          celebrations when the freshest meat could be sourced at dawn, often ground by hand with a stone mortar to
          achieve the signature silkiness.
        </p>
        <p className="text-lg text-midnight/80">
          By the late 19th century, regional cookbooks documented variations that incorporated regional aromatics like
          Aleppo pepper, marjoram, and mint. Urban kitchens in Beirut and Aleppo refined the dish further, pairing it
          with chilled arak, olive oil, and garden herbs. Today, Kibbeh Nayeh remains a hallmark of hospitality—a dish
          served to honor guests with freshness, technique, and trust.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sources</CardTitle>
          <CardDescription>Selected references for historical context</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-midnight/80">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Barbara Abdeni Massaad, <em>Man'oushé &amp; Mouneh</em> (2014) — interviews on rural kibbeh traditions.
            </li>
            <li>
              Anissa Helou, <em>Feast: Food of the Islamic World</em> (2018) — chapter on Levantine raw kibbeh and serving customs.
            </li>
            <li>
              Charles Perry, papers for the Oxford Symposium on Food &amp; Cookery (2001) — notes on medieval Levantine meat dishes.
            </li>
            <li>
              Lebanese Ministry of Culture, Baalbek site publications — context on agrarian feasts and communal meat preparation.
            </li>
            <li>
              Nahla Khoury, <em>Rural Foodways in Mount Lebanon</em> (Journal of Middle Eastern Studies, 2012) — seasonal preparation practices.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Our Story</CardTitle>
          <CardDescription>Editable placeholder—share your sourcing and kitchen standards</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-midnight/80">
          <p>
            We prepare Kibbeh Nayeh before sunrise with grass-fed beef, premium fine bulgur, and cold-pressed olive oil.
            Each batch is mixed by hand, quickly chilled, and delivered in insulated packaging to maintain temperature and texture.
          </p>
          <p>
            Update this section with your farm partners, certifications, pickup address, and the story of who makes each batch.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

